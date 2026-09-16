INSERT INTO experience_ranges (code, label, sort_order) VALUES
  ('less_than_1_year', 'Less than 1 year', 1),
  ('one_to_three_years', '1 to 3 years', 2),
  ('three_to_five_years', '3 to 5 years', 3),
  ('five_plus_years', '5+ years', 4)
ON CONFLICT (code) DO NOTHING;

INSERT INTO availability_options (code, label) VALUES
  ('freelance', 'Freelance / gigs'),
  ('long_term', 'Long-term / permanent')
ON CONFLICT (code) DO NOTHING;

INSERT INTO instruments (slug, name) VALUES
  ('vocals', 'Vocals'),
  ('electric_guitar', 'Electric Guitar'),
  ('acoustic_guitar', 'Acoustic Guitar'),
  ('bass_guitar', 'Bass Guitar'),
  ('drums', 'Drums'),
  ('keyboard', 'Keyboard / Piano'),
  ('violin', 'Violin'),
  ('saxophone', 'Saxophone'),
  ('trumpet', 'Trumpet'),
  ('dj', 'DJ / Turntables')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO music_genres (slug, name) VALUES
  ('rock', 'Rock'),
  ('pop', 'Pop'),
  ('jazz', 'Jazz'),
  ('blues', 'Blues'),
  ('classical', 'Classical'),
  ('hip_hop', 'Hip Hop'),
  ('electronic', 'Electronic'),
  ('metal', 'Metal'),
  ('country', 'Country'),
  ('latin', 'Latin')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO technical_services (slug, name) VALUES
  ('recording_engineer', 'Recording Engineer'),
  ('mixing_engineer', 'Mixing Engineer'),
  ('mastering_engineer', 'Mastering Engineer'),
  ('live_sound_engineer', 'Live Sound Engineer'),
  ('lighting_technician', 'Lighting Technician'),
  ('event_manager', 'Event Manager'),
  ('photographer', 'Photographer'),
  ('videographer', 'Videographer'),
  ('music_producer', 'Music Producer'),
  ('stage_manager', 'Stage Manager')
ON CONFLICT (slug) DO NOTHING;

