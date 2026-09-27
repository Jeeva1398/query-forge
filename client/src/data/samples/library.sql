-- Library sample: authors, books, members, loans
-- "Today" for this dataset is 2026-09-01: loans with no returned_on and an earlier due_on are overdue.

CREATE TABLE authors (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  country    text,
  birth_year int
);

CREATE TABLE books (
  id             serial PRIMARY KEY,
  title          text NOT NULL,
  author_id      int NOT NULL REFERENCES authors (id),
  genre          text NOT NULL,
  published_year int NOT NULL,
  isbn           text UNIQUE,
  copies         int NOT NULL DEFAULT 1
);

CREATE TABLE members (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  email      text NOT NULL UNIQUE,
  joined_on  date NOT NULL,
  membership text NOT NULL CHECK (membership IN ('basic', 'premium'))
);

CREATE TABLE loans (
  id          serial PRIMARY KEY,
  book_id     int NOT NULL REFERENCES books (id),
  member_id   int NOT NULL REFERENCES members (id),
  loaned_on   date NOT NULL,
  due_on      date NOT NULL,
  returned_on date
);

INSERT INTO authors (name, country, birth_year) VALUES
  ('R. K. Narayan', 'India', 1906),
  ('Kalki Krishnamurthy', 'India', 1899),
  ('Arundhati Roy', 'India', 1961),
  ('Jane Austen', 'United Kingdom', 1775),
  ('George Orwell', 'United Kingdom', 1903),
  ('Haruki Murakami', 'Japan', 1949),
  ('Gabriel García Márquez', 'Colombia', 1927),
  ('Chimamanda Ngozi Adichie', 'Nigeria', 1977),
  ('Yuval Noah Harari', 'Israel', 1976),
  ('Martin Kleppmann', 'Germany', NULL),
  ('Anonymous Collective', NULL, NULL),
  ('Isaac Asimov', 'United States', 1920);

INSERT INTO books (title, author_id, genre, published_year, isbn, copies) VALUES
  ('Malgudi Days', 1, 'Short Stories', 1943, '978-0000000001', 3),
  ('The Guide', 1, 'Fiction', 1958, '978-0000000002', 2),
  ('Swami and Friends', 1, 'Fiction', 1935, '978-0000000003', 2),
  ('Ponniyin Selvan', 2, 'Historical', 1955, '978-0000000004', 4),
  ('Sivagamiyin Sabatham', 2, 'Historical', 1948, '978-0000000005', 1),
  ('The God of Small Things', 3, 'Fiction', 1997, '978-0000000006', 2),
  ('Pride and Prejudice', 4, 'Classic', 1813, '978-0000000007', 3),
  ('Emma', 4, 'Classic', 1815, '978-0000000008', 1),
  ('1984', 5, 'Dystopian', 1949, '978-0000000009', 4),
  ('Animal Farm', 5, 'Dystopian', 1945, '978-0000000010', 3),
  ('Norwegian Wood', 6, 'Fiction', 1987, '978-0000000011', 2),
  ('Kafka on the Shore', 6, 'Fiction', 2002, '978-0000000012', 1),
  ('One Hundred Years of Solitude', 7, 'Classic', 1967, '978-0000000013', 2),
  ('Half of a Yellow Sun', 8, 'Historical', 2006, '978-0000000014', 1),
  ('Americanah', 8, 'Fiction', 2013, '978-0000000015', 2),
  ('Sapiens', 9, 'Non-fiction', 2011, '978-0000000016', 5),
  ('Homo Deus', 9, 'Non-fiction', 2015, '978-0000000017', 2),
  ('Designing Data-Intensive Applications', 10, 'Technology', 2017, '978-0000000018', 3),
  ('Folk Tales of the South', 11, 'Short Stories', 1990, NULL, 1),
  ('Foundation', 12, 'Science Fiction', 1951, '978-0000000020', 2),
  ('I, Robot', 12, 'Science Fiction', 1950, '978-0000000021', 2),
  ('The Gods Themselves', 12, 'Science Fiction', 1972, '978-0000000022', 1),
  ('Waiting for the Mahatma', 1, 'Fiction', 1955, '978-0000000023', 1),
  ('Parthiban Kanavu', 2, 'Historical', 1942, '978-0000000024', 1),
  ('The Ministry of Utmost Happiness', 3, 'Fiction', 2017, '978-0000000025', 1);

INSERT INTO members (name, email, joined_on, membership) VALUES
  ('Aravind', 'aravind@mail.example', '2023-01-12', 'premium'),
  ('Bhuvana', 'bhuvana@mail.example', '2023-03-08', 'basic'),
  ('Charan', 'charan@mail.example', '2023-06-21', 'basic'),
  ('Dhivya', 'dhivya@mail.example', '2023-09-02', 'premium'),
  ('Elango', 'elango@mail.example', '2024-01-15', 'basic'),
  ('Fathima', 'fathima@mail.example', '2024-02-28', 'basic'),
  ('Ganesh', 'ganesh@mail.example', '2024-05-10', 'premium'),
  ('Hema', 'hema@mail.example', '2024-07-19', 'basic'),
  ('Inba', 'inba@mail.example', '2024-10-03', 'basic'),
  ('Janani', 'janani@mail.example', '2025-01-07', 'premium'),
  ('Kishore', 'kishore@mail.example', '2025-03-25', 'basic'),
  ('Latha', 'latha@mail.example', '2025-06-14', 'basic'),
  ('Mohan', 'mohan@mail.example', '2025-09-30', 'premium'),
  ('Nandhini', 'nandhini@mail.example', '2026-02-11', 'basic'),
  ('Om Prakash', 'om@mail.example', '2026-07-01', 'basic');

-- 150 loans with a 14 day due date; the last 20 were never returned (overdue as of 2026-09-01)
INSERT INTO loans (book_id, member_id, loaned_on, due_on, returned_on)
SELECT
  (g * 7) % 25 + 1,
  (g * 4) % 13 + 1,
  date '2025-09-01' + (g * 2),
  date '2025-09-01' + (g * 2) + 14,
  CASE
    WHEN g > 130 THEN NULL
    WHEN g % 9 = 0 THEN date '2025-09-01' + (g * 2) + 20
    ELSE date '2025-09-01' + (g * 2) + (g % 12) + 1
  END
FROM generate_series(1, 150) AS g;
