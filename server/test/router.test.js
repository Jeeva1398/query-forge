import { describe, expect, it } from 'vitest';
import { mentionedTables, pickTier, scoreComplexity } from '../src/router.js';

const shopDdl = `
  CREATE TABLE categories (id serial PRIMARY KEY, name text, parent_id int);
  CREATE TABLE customers (id serial PRIMARY KEY, first_name text, city text);
  CREATE TABLE products (id serial PRIMARY KEY, name text, category_id int, price numeric);
  CREATE TABLE orders (id serial PRIMARY KEY, customer_id int, order_date timestamp, status text);
  CREATE TABLE order_items (order_id int, product_id int, quantity int, unit_price numeric);
  CREATE TABLE reviews (id serial PRIMARY KEY, product_id int, customer_id int, rating int);
`;

const hrDdl = `
  CREATE TABLE departments (id serial PRIMARY KEY, name text);
  CREATE TABLE employees (id serial PRIMARY KEY, name text, manager_id int, department_id int);
`;

const tier = (prompt, ddl = shopDdl) =>
  pickTier('generate', { prompt, ddl, threshold: 4 }).tier;

describe('generate routing', () => {
  it.each([
    ['list all customers', 'lite'],
    ['customers from Chennai', 'lite'],
    ['how many orders were cancelled', 'lite'],
    ['average order value per customer', 'lite'],
    ['customers who never placed an order', 'lite'],
    ['rank customers by total spend', 'lite'],
    ['rank customers by total spend per city', 'flash'],
    ['top 3 products per category by revenue with a running total', 'flash'],
    [
      'median time between order and review per month, compared across categories',
      'flash',
    ],
  ])('%s -> %s', (prompt, expected) => {
    expect(tier(prompt)).toBe(expected);
  });

  it('sends recursive org-chart questions to flash', () => {
    expect(
      tier(
        'org chart: every employee with the chain of managers above them',
        hrDdl,
      ),
    ).toBe('flash');
  });

  it('counts long prompts that touch many tables as complex', () => {
    const prompt =
      'Show every customer with the products they bought, the category of each product, ' +
      'how many reviews they wrote for those products and the order dates, only for orders ' +
      'that were delivered, and include customers from Chennai and Bengaluru only please.';
    expect(prompt.length).toBeGreaterThan(200);
    expect(tier(prompt)).toBe('flash');
  });
});

describe('scoreComplexity', () => {
  it('is 0 for a plain lookup', () => {
    expect(scoreComplexity({ prompt: 'list all products', ddl: shopDdl })).toBe(
      0,
    );
  });

  it('looks at the SQL too (used by explain and fix)', () => {
    const sql =
      'SELECT id, sum(total) OVER (PARTITION BY customer_id ORDER BY order_date) FROM orders';
    expect(
      scoreComplexity({ prompt: '', sql, ddl: shopDdl }),
    ).toBeGreaterThanOrEqual(3);
  });

  it('finds table names in plain English', () => {
    expect(
      mentionedTables('products in each category with reviews', shopDdl).sort(),
    ).toEqual(['categories', 'products', 'reviews']);
  });
});

describe('route defaults', () => {
  it('fix starts on lite and moves to flash on the second attempt', () => {
    expect(pickTier('fix', { attempt: 1 }).tier).toBe('lite');
    expect(pickTier('fix', { attempt: 2 }).tier).toBe('flash');
  });

  it('only hard exercises use flash', () => {
    expect(pickTier('exercise', { difficulty: 'easy' }).tier).toBe('lite');
    expect(pickTier('exercise', { difficulty: 'hard' }).tier).toBe('flash');
  });

  it('grading uses flash only for a failed hard exercise', () => {
    expect(pickTier('grade', { passed: true, difficulty: 'hard' }).tier).toBe(
      'lite',
    );
    expect(pickTier('grade', { passed: false, difficulty: 'easy' }).tier).toBe(
      'lite',
    );
    expect(pickTier('grade', { passed: false, difficulty: 'hard' }).tier).toBe(
      'flash',
    );
  });

  it('explain needs one point more than generate', () => {
    const ctx = {
      prompt: 'rank customers by total spend per city',
      ddl: shopDdl,
      threshold: 4,
    };
    expect(pickTier('generate', ctx).tier).toBe('flash');
    expect(pickTier('explain', ctx).tier).toBe('lite');
  });

  it('hints always use lite', () => {
    expect(
      pickTier('hint', { prompt: 'recursive running total rank' }).tier,
    ).toBe('lite');
  });
});
