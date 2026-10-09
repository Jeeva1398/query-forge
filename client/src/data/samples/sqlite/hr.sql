-- HR sample (SQLite version): same tables and rows as the Postgres one.
-- Types: serial -> INTEGER PRIMARY KEY, numeric -> NUMERIC, dates -> TEXT ('2026-01-31').

CREATE TABLE departments (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  budget   NUMERIC NOT NULL
);

CREATE TABLE employees (
  id             INTEGER PRIMARY KEY,
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  department_id  INTEGER REFERENCES departments (id),
  manager_id     INTEGER REFERENCES employees (id),
  job_title      TEXT NOT NULL,
  hire_date      TEXT NOT NULL,
  salary         NUMERIC NOT NULL,
  commission_pct NUMERIC
);

CREATE TABLE salary_history (
  employee_id    INTEGER NOT NULL REFERENCES employees (id),
  salary         NUMERIC NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to   TEXT,
  PRIMARY KEY (employee_id, effective_from)
);

CREATE TABLE projects (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  department_id INTEGER NOT NULL REFERENCES departments (id),
  start_date    TEXT NOT NULL,
  end_date      TEXT
);

CREATE TABLE employee_projects (
  employee_id INTEGER NOT NULL REFERENCES employees (id),
  project_id  INTEGER NOT NULL REFERENCES projects (id),
  role        TEXT NOT NULL,
  hours       INTEGER NOT NULL,
  PRIMARY KEY (employee_id, project_id)
);

INSERT INTO departments (name, location, budget) VALUES
  ('Executive', 'Chennai', 5000000),
  ('Engineering', 'Bengaluru', 12000000),
  ('Sales', 'Mumbai', 6000000),
  ('Marketing', 'Mumbai', 3500000),
  ('Finance', 'Chennai', 2500000),
  ('Support', 'Coimbatore', 1800000),
  ('Research', 'Pune', 4000000);

-- ids are assigned in this order, so manager_id values point at earlier rows
INSERT INTO employees (first_name, last_name, email, department_id, manager_id, job_title, hire_date, salary, commission_pct) VALUES
  ('Lakshmi', 'Narayanan', 'lakshmi@corp.example', 1, NULL, 'CEO', '2015-04-01', 450000, NULL),
  ('Suresh', 'Babu', 'suresh@corp.example', 2, 1, 'VP Engineering', '2016-06-15', 320000, NULL),
  ('Nisha', 'Kapoor', 'nisha@corp.example', 3, 1, 'VP Sales', '2017-01-10', 300000, 0.05),
  ('Farhan', 'Qureshi', 'farhan@corp.example', 5, 1, 'CFO', '2016-11-20', 310000, NULL),
  ('Deepa', 'Krishnan', 'deepa@corp.example', 2, 2, 'Engineering Manager', '2018-03-05', 210000, NULL),
  ('Ravi', 'Shankar', 'ravi@corp.example', 2, 2, 'Engineering Manager', '2019-07-22', 205000, NULL),
  ('Kavya', 'Reddy', 'kavya@corp.example', 2, 5, 'Senior Developer', '2019-09-01', 165000, NULL),
  ('Ajay', 'Verma', 'ajay@corp.example', 2, 5, 'Developer', '2021-02-15', 110000, NULL),
  ('Pooja', 'Sharma', 'pooja@corp.example', 2, 5, 'Developer', '2022-08-01', 98000, NULL),
  ('Manoj', 'Pillai', 'manoj@corp.example', 2, 6, 'Senior Developer', '2020-05-11', 158000, NULL),
  ('Swathi', 'Rao', 'swathi@corp.example', 2, 6, 'QA Engineer', '2021-10-04', 92000, NULL),
  ('Imran', 'Sheikh', 'imran@corp.example', 2, 6, 'Developer', '2023-01-16', 88000, NULL),
  ('Gayathri', 'Mohan', 'gayathri@corp.example', 3, 3, 'Sales Manager', '2018-12-03', 150000, 0.08),
  ('Harish', 'Gowda', 'harish@corp.example', 3, 13, 'Account Executive', '2020-03-23', 85000, 0.12),
  ('Neha', 'Joshi', 'neha@corp.example', 3, 13, 'Account Executive', '2022-06-13', 78000, 0.12),
  ('Tarun', 'Malhotra', 'tarun@corp.example', 3, 13, 'Sales Associate', '2024-04-08', 52000, 0.15),
  ('Bhavana', 'Shetty', 'bhavana@corp.example', 4, 3, 'Marketing Manager', '2019-02-18', 140000, NULL),
  ('Siddharth', 'Bose', 'siddharth@corp.example', 4, 17, 'Content Strategist', '2021-11-29', 76000, NULL),
  ('Revathi', 'Sundaram', 'revathi@corp.example', 5, 4, 'Accountant', '2020-08-17', 82000, NULL),
  ('Gokul', 'Prasad', 'gokul@corp.example', 5, 4, 'Financial Analyst', '2023-05-02', 90000, NULL),
  ('Anitha', 'Joseph', 'anitha@corp.example', 6, 2, 'Support Lead', '2019-06-24', 95000, NULL),
  ('Vinoth', 'Kumar', 'vinoth@corp.example', 6, 21, 'Support Engineer', '2022-01-10', 60000, NULL),
  ('Keerthana', 'Balaji', 'keerthana@corp.example', 6, 21, 'Support Engineer', '2024-09-02', 55000, NULL),
  ('Arvind', 'Chari', 'arvind@corp.example', NULL, 1, 'Advisor', '2025-02-01', 120000, NULL);

-- two or three salary changes per employee, ending at today's salary
-- (SQLite's round() has no negative precision, so round to thousands by hand)
INSERT INTO salary_history (employee_id, salary, effective_from, effective_to)
SELECT id, round(salary * 0.80 / 1000) * 1000, hire_date, date(hire_date, '+2 years')
FROM employees WHERE hire_date < '2023-01-01'
UNION ALL
SELECT id, round(salary * 0.90 / 1000) * 1000, date(hire_date, '+2 years'), '2025-04-01'
FROM employees WHERE hire_date < '2023-01-01'
UNION ALL
SELECT id, round(salary * 0.92 / 1000) * 1000, hire_date, '2025-04-01'
FROM employees WHERE hire_date >= '2023-01-01' AND hire_date < '2025-04-01'
UNION ALL
SELECT id, salary, max(hire_date, '2025-04-01'), NULL
FROM employees;

INSERT INTO projects (name, department_id, start_date, end_date) VALUES
  ('Mobile App Rewrite', 2, '2025-01-06', NULL),
  ('Billing Platform', 2, '2024-06-01', '2025-08-30'),
  ('Data Warehouse', 7, '2025-03-01', NULL),
  ('Q3 Sales Push', 3, '2025-07-01', '2025-09-30'),
  ('Brand Refresh', 4, '2025-02-15', '2025-06-30'),
  ('Audit Automation', 5, '2025-05-01', NULL),
  ('Help Center Revamp', 6, '2025-04-14', NULL);

INSERT INTO employee_projects (employee_id, project_id, role, hours) VALUES
  (5, 1, 'Lead', 320), (7, 1, 'Developer', 540), (8, 1, 'Developer', 610), (9, 1, 'Developer', 480), (11, 1, 'QA', 260),
  (6, 2, 'Lead', 410), (10, 2, 'Developer', 700), (12, 2, 'Developer', 520), (11, 2, 'QA', 300),
  (7, 3, 'Developer', 220), (20, 3, 'Analyst', 180), (10, 3, 'Developer', 150),
  (13, 4, 'Lead', 200), (14, 4, 'Seller', 350), (15, 4, 'Seller', 330), (16, 4, 'Seller', 290),
  (17, 5, 'Lead', 240), (18, 5, 'Writer', 310),
  (19, 6, 'Analyst', 190), (20, 6, 'Analyst', 260), (8, 6, 'Developer', 120),
  (21, 7, 'Lead', 210), (22, 7, 'Support', 280), (23, 7, 'Support', 160), (18, 7, 'Writer', 90);
