INSERT INTO organizations (name, allowed_domain) VALUES ('HubSpot', 'hubspot.com');

INSERT INTO users (
  email,
  password_hash,
  password_salt,
  organization_id,
  role,
  display_name
) VALUES (
  'smcelhinney@hubspot.com',
  '4280186af6401b6edef2fb916cf9de372e5ff07576d2fadad17972cc072ca393',
  '7c7d79f845911091f896963e1f9a071f',
  (SELECT id FROM organizations WHERE allowed_domain = 'hubspot.com'),
  'admin',
  'Stephen McElhinney'
);
