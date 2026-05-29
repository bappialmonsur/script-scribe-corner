UPDATE auth.users
SET encrypted_password = extensions.crypt('somikoron@2013', extensions.gen_salt('bf')),
    updated_at = now()
WHERE email = '8801920746162@somikoron.local';