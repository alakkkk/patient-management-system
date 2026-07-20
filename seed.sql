-- Fake patients for testing. Run AFTER schema.sql, in the Supabase SQL editor.
-- created_by is left null; appointments and visits are created through the app
-- once you've signed up at least one staff user (they need a provider).

insert into patients (mrn, full_name, dob, phone, email, address) values
  ('MRN-1001', 'Amara Okafor',      '1988-03-12', '555-0142', 'amara.o@test.local',   '14 Elm Street'),
  ('MRN-1002', 'Liam Petrov',       '1975-11-02', '555-0198', 'liam.p@test.local',    '9 Birch Lane'),
  ('MRN-1003', 'Sofia Rossi',       '1992-07-25', '555-0110', 'sofia.r@test.local',   '221 Maple Ave'),
  ('MRN-1004', 'Noah Kim',          '2001-01-08', '555-0177', 'noah.k@test.local',    '5 Cedar Court'),
  ('MRN-1005', 'Fatima Al-Sayed',   '1969-09-30', '555-0155', 'fatima.a@test.local',  '88 Oak Drive'),
  ('MRN-1006', 'James Whitfield',   '1954-05-19', '555-0123', 'james.w@test.local',   '3 Pine Road'),
  ('MRN-1007', 'Mei Chen',          '1997-12-14', '555-0166', 'mei.c@test.local',     '47 Willow Way'),
  ('MRN-1008', 'Diego Marquez',     '1983-06-06', '555-0189', 'diego.m@test.local',   '12 Aspen Blvd'),
  ('MRN-1009', 'Priya Nair',        '1990-04-21', '555-0134', 'priya.n@test.local',   '67 Spruce St'),
  ('MRN-1010', 'Ethan Brooks',      '2010-08-17', '555-0101', 'guardian.b@test.local','30 Hazel Grove'),
  ('MRN-1011', 'Yuki Tanaka',       '1965-02-28', '555-0172', 'yuki.t@test.local',    '19 Poplar Place'),
  ('MRN-1012', 'Grace Adeyemi',     '1979-10-11', '555-0148', 'grace.a@test.local',   '256 Chestnut Rd');
