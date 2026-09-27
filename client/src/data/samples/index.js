import ecommerce from './ecommerce.sql?raw';
import hr from './hr.sql?raw';
import library from './library.sql?raw';

export const DATASETS = [
  {
    id: 'ecommerce',
    label: 'E-commerce',
    seed: ecommerce,
    starter: `-- Top 5 customers by money spent on delivered orders
SELECT c.first_name, c.last_name, sum(oi.quantity * oi.unit_price) AS total_spent
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status = 'delivered'
GROUP BY c.id
ORDER BY total_spent DESC
LIMIT 5;
`,
  },
  {
    id: 'hr',
    label: 'HR',
    seed: hr,
    starter: `-- Each employee with their manager
SELECT e.first_name || ' ' || e.last_name AS employee,
       e.job_title,
       m.first_name || ' ' || m.last_name AS manager
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id
ORDER BY e.id;
`,
  },
  {
    id: 'library',
    label: 'Library',
    seed: library,
    starter: `-- Loans that are still out and overdue
SELECT m.name AS member, b.title, l.due_on
FROM loans l
JOIN books b ON b.id = l.book_id
JOIN members m ON m.id = l.member_id
WHERE l.returned_on IS NULL AND l.due_on < DATE '2026-09-01'
ORDER BY l.due_on;
`,
  },
  {
    id: 'empty',
    label: 'Empty database',
    seed: '',
    starter: `CREATE TABLE notes (id serial PRIMARY KEY, body text NOT NULL);
INSERT INTO notes (body) VALUES ('hello'), ('world');
SELECT * FROM notes;
`,
  },
];

export const findDataset = (id) =>
  DATASETS.find((d) => d.id === id) || DATASETS[0];
