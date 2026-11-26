-- ==============================================================================
-- TRIO DEALERS - ADMIN + PRODUCTION CATALOG SEED SCRIPT
-- Provisions admin (annuncio8427@gmail.com) and optional storefront catalog.
-- Safe against existing MVP tables/rows (checks both id and slug).
-- Note: Run supabase/schema.sql first before running this script.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE IF EXISTS public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'shop', 'b2b', 'transporter', 'user'));

DO $$
DECLARE
  v_admin_id uuid;
  v_admin_email text := 'annuncio8427@gmail.com';
  v_admin_pass text := 'CHANGE_ME_STRONG_ADMIN_PASSWORD'; -- Replace before running in SQL Editor

  v_house_shop_id uuid := '30000000-0000-0000-0000-000000000001';
  v_existing_id uuid;

  -- Brands & Size Charts
  v_brand_atelier uuid := '44444444-4444-4444-4444-444444444401';
  v_brand_kanchi uuid := '44444444-4444-4444-4444-444444444402';
  v_brand_giza uuid := '44444444-4444-4444-4444-444444444403';
  v_brand_jaipur uuid := '44444444-4444-4444-4444-444444444404';
  v_brand_varanasi uuid := '44444444-4444-4444-4444-444444444405';

  v_chart_women uuid := '55555555-5555-5555-5555-555555555501';
  v_chart_men uuid := '55555555-5555-5555-5555-555555555502';

  -- Categories
  v_cat_silk uuid := '11111111-1111-1111-1111-111111111101';
  v_cat_cotton uuid := '11111111-1111-1111-1111-111111111102';
  v_cat_kurti uuid := '11111111-1111-1111-1111-111111111103';
  v_cat_lehenga uuid := '11111111-1111-1111-1111-111111111104';
  v_cat_linen uuid := '11111111-1111-1111-1111-111111111105';
  v_cat_dupattas uuid := '11111111-1111-1111-1111-111111111106';
  v_cat_brocade uuid := '11111111-1111-1111-1111-111111111107';
  v_cat_handloom uuid := '11111111-1111-1111-1111-111111111108';
  v_sub_kanji uuid := '11111111-1111-1111-1111-111111111201';
  v_sub_banarasi uuid := '11111111-1111-1111-1111-111111111202';
  v_sub_giza uuid := '11111111-1111-1111-1111-111111111203';
  v_sub_chanderi uuid := '11111111-1111-1111-1111-111111111204';

  -- Catalog Products
  v_p1 uuid := '22222222-2222-2222-2222-222222222201';
  v_p2 uuid := '22222222-2222-2222-2222-222222222202';
  v_p3 uuid := '22222222-2222-2222-2222-222222222203';
  v_p4 uuid := '22222222-2222-2222-2222-222222222204';
  v_p5 uuid := '22222222-2222-2222-2222-222222222205';
  v_p6 uuid := '22222222-2222-2222-2222-222222222206';
  v_p7 uuid := '22222222-2222-2222-2222-222222222207';
  v_p8 uuid := '22222222-2222-2222-2222-222222222208';
  v_p9 uuid := '22222222-2222-2222-2222-222222222209';
  v_p10 uuid := '22222222-2222-2222-2222-222222222210';

  rec RECORD;
BEGIN
  -- 1. PROVISION ADMIN USER (annuncio8427@gmail.com)
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE lower(email) = lower(v_admin_email)
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    v_admin_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    VALUES (
      v_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_admin_email, crypt(v_admin_pass, gen_salt('bf')),
      now(), '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Trio Dealers Admin","role":"admin"}'::jsonb,
      now(), now()
    );
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = crypt(v_admin_pass, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change = COALESCE(email_change, ''),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"full_name":"Trio Dealers Admin","role":"admin"}'::jsonb,
      updated_at = now()
    WHERE id = v_admin_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = v_admin_id AND provider = 'email'
  ) THEN
    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(), v_admin_id, v_admin_id::text,
      jsonb_build_object('sub', v_admin_id::text, 'email', v_admin_email, 'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now()
    );
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (v_admin_id, v_admin_email, 'Trio Dealers Admin', 'admin', true)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = 'admin',
    is_active = true,
    updated_at = now();

  -- 2. TRIO DEALERS HOUSE MILL STOREFRONT (checks both id and slug)
  SELECT id INTO v_existing_id
  FROM public.shops
  WHERE id = v_house_shop_id OR slug = 'trio-dealers-house'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.shops
    SET owner_id = v_admin_id, kyc_status = 'approved'
    WHERE id = v_existing_id;
    v_house_shop_id := v_existing_id;
  ELSE
    INSERT INTO public.shops (
      id, owner_id, shop_name, slug, gstin, pan,
      address_line1, address_line2, city, state, pincode,
      bank_name, bank_account_no, bank_ifsc, kyc_status, commission_rate, rating, reviews_count
    )
    VALUES (
      v_house_shop_id, v_admin_id, 'Trio Dealers House Mill', 'trio-dealers-house',
      '24AABCT0001A1Z5', 'AABCT0001A',
      'Plot 12, Millennium Textile Market', 'Ring Road', 'Surat', 'Gujarat', '395002',
      'HDFC Bank Ltd', '50200012345678', 'HDFC0001234', 'approved', 0.00, 5.00, 0
    );
  END IF;

  -- 3. CATEGORIES (checks both id and slug)
  FOR rec IN
    SELECT * FROM (
      VALUES
        (v_cat_silk, 'Silk & Banarasi Sarees', 'silk-sarees', 'Pure mulberry, tussar and authentic Banarasi handlooms woven with gold and silver zari.', 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80', 1),
        (v_cat_cotton, 'Premium Cotton Shirting', 'cotton-shirting-suiting', 'High-thread-count Egyptian Giza, Oxford and Supima cottons for tailored bespoke garments.', 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=800&q=80', 2),
        (v_cat_kurti, 'Designer Kurtis & Tunics', 'designer-kurtis', 'Ready-to-wear ethnic kurtis with hand embroidery, Lucknowi chikankari and gota patti.', 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80', 3),
        (v_cat_lehenga, 'Luxury Bridal Lehengas', 'bridal-lehengas', 'Exquisite bridal couture crafted with velvet, raw silk, zardozi and swarovski crystal work.', 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80', 4),
        (v_cat_linen, 'Pure Linen & Raw Fabrics', 'pure-linen-fabrics', '100% natural European flax linen and wild raw silk fabrics by meter or bulk lot.', 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=800&q=80', 5),
        (v_cat_dupattas, 'Festive Dupattas & Stoles', 'festive-dupattas', 'Phulkari, kalamkari and Banarasi brocade dupattas for ceremonial ensembles.', 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80', 6),
        (v_cat_brocade, 'Velvet & Brocades', 'velvet-brocades', 'Heavy micro-velvet and gold brocades for ceremonial sherwanis and blouses.', 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?auto=format&fit=crop&w=800&q=80', 7),
        (v_cat_handloom, 'Artisanal Handlooms', 'artisanal-handlooms', 'Ikkat, patola, and chanderi fabrics directly sourced from registered craft clusters.', 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&w=800&q=80', 8)
    ) AS c(cid, cname, cslug, cdesc, cimg, csort)
  LOOP
    SELECT id INTO v_existing_id FROM public.categories WHERE id = rec.cid OR slug = rec.cslug LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      UPDATE public.categories
      SET name = rec.cname, description = rec.cdesc, image_url = rec.cimg, sort_order = rec.csort
      WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.categories (id, name, slug, description, image_url, sort_order)
      VALUES (rec.cid, rec.cname, rec.cslug, rec.cdesc, rec.cimg, rec.csort);
    END IF;
  END LOOP;

  SELECT id INTO v_cat_silk FROM public.categories WHERE id = v_cat_silk OR slug = 'silk-sarees' LIMIT 1;
  SELECT id INTO v_cat_cotton FROM public.categories WHERE id = v_cat_cotton OR slug = 'cotton-shirting-suiting' LIMIT 1;
  SELECT id INTO v_cat_kurti FROM public.categories WHERE id = v_cat_kurti OR slug = 'designer-kurtis' LIMIT 1;
  SELECT id INTO v_cat_lehenga FROM public.categories WHERE id = v_cat_lehenga OR slug = 'bridal-lehengas' LIMIT 1;
  SELECT id INTO v_cat_linen FROM public.categories WHERE id = v_cat_linen OR slug = 'pure-linen-fabrics' LIMIT 1;

  -- 3B. SUB-CATEGORIES (parent_id hierarchy)
  FOR rec IN
    SELECT * FROM (
      VALUES
        (v_sub_kanji, v_cat_silk, 'Kanjivaram Pure Silk', 'kanjivaram-pure-silk', 'Traditional Kanchipuram temple-border mulberry silks.', 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80', 11),
        (v_sub_banarasi, v_cat_silk, 'Banarasi Zari Brocade', 'banarasi-zari-brocade', 'Varanasi katan silk jaal and kadwa brocade weaves.', 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=800&q=80', 12),
        (v_sub_giza, v_cat_cotton, 'Giza & Supima Shirting', 'giza-supima-shirting', 'Long-staple breathable formal shirting cuts.', 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=800&q=80', 13),
        (v_sub_chanderi, v_cat_kurti, 'Chanderi & Handblock', 'chanderi-handblock', 'Festive silk-cotton weaves & artisanal Bagru prints.', 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80', 14)
    ) AS sc(cid, pparent, cname, cslug, cdesc, cimg, csort)
  LOOP
    SELECT id INTO v_existing_id FROM public.categories WHERE id = rec.cid OR slug = rec.cslug LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      UPDATE public.categories
      SET parent_id = rec.pparent, name = rec.cname, description = rec.cdesc, image_url = rec.cimg, sort_order = rec.csort, is_active = true
      WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.categories (id, parent_id, name, slug, description, image_url, sort_order, is_active)
      VALUES (rec.cid, rec.pparent, rec.cname, rec.cslug, rec.cdesc, rec.cimg, rec.csort, true);
    END IF;
  END LOOP;

  -- 3C. BRANDS (5 curated textile mills & ateliers)
  FOR rec IN
    SELECT * FROM (
      VALUES
        (v_brand_atelier, 'Trio Royal Atelier', 'trio-royal-atelier'),
        (v_brand_kanchi, 'Kanchi Heritage Weaves', 'kanchi-heritage-weaves'),
        (v_brand_giza, 'Surat Giza Mills', 'surat-giza-mills'),
        (v_brand_jaipur, 'Jaipur Block House', 'jaipur-block-house'),
        (v_brand_varanasi, 'Varanasi Zari Guild', 'varanasi-zari-guild')
    ) AS b(bid, bname, bslug)
  LOOP
    SELECT id INTO v_existing_id FROM public.brands WHERE id = rec.bid OR slug = rec.bslug LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.brands (id, name, slug, is_active) VALUES (rec.bid, rec.bname, rec.bslug, true);
    END IF;
  END LOOP;
  SELECT id INTO v_brand_atelier FROM public.brands WHERE slug = 'trio-royal-atelier' LIMIT 1;
  SELECT id INTO v_brand_kanchi FROM public.brands WHERE slug = 'kanchi-heritage-weaves' LIMIT 1;
  SELECT id INTO v_brand_giza FROM public.brands WHERE slug = 'surat-giza-mills' LIMIT 1;
  SELECT id INTO v_brand_jaipur FROM public.brands WHERE slug = 'jaipur-block-house' LIMIT 1;
  SELECT id INTO v_brand_varanasi FROM public.brands WHERE slug = 'varanasi-zari-guild' LIMIT 1;

  -- 3D. SIZE CHARTS (2 standard charts)
  IF NOT EXISTS (SELECT 1 FROM public.size_charts WHERE id = v_chart_women OR name = 'Women Ethnic Wear & Sarees') THEN
    INSERT INTO public.size_charts (id, name, category_id, chart)
    VALUES (
      v_chart_women,
      'Women Ethnic Wear & Sarees',
      v_cat_kurti,
      '{"columns":["Size","Bust (in)","Waist (in)","Hip (in)","Length (in)"],"rows":[["S (36)","36","30","39","44"],["M (38)","38","32","41","44"],["L (40)","40","34","43","45"],["XL (42)","42","36","45","45"],["Free Size (6.3m)","5.5m Saree + 0.8m Blouse","-","-","44-46 in Width"]]}'::jsonb
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.size_charts WHERE id = v_chart_men OR name = 'Unstitched Shirting & Suiting Cuts') THEN
    INSERT INTO public.size_charts (id, name, category_id, chart)
    VALUES (
      v_chart_men,
      'Unstitched Shirting & Suiting Cuts',
      v_cat_cotton,
      '{"columns":["Cut Type","Length","Panna / Width","Recommended Garment"],"rows":[["2.5 Meter Cut","2.50 m","58 in","Full-Sleeve Formal Shirt (up to XXL)"],["3.0 Meter Suiting","3.00 m","58-60 in","2-Piece Blazer + Trouser"],["Per Meter Roll","1.00 m+","58 in","Custom Bulk Tailoring"]]}'::jsonb
    );
  END IF;
  SELECT id INTO v_chart_women FROM public.size_charts WHERE id = v_chart_women OR name = 'Women Ethnic Wear & Sarees' LIMIT 1;
  SELECT id INTO v_chart_men FROM public.size_charts WHERE id = v_chart_men OR name = 'Unstitched Shirting & Suiting Cuts' LIMIT 1;

  -- 4. CATALOG PRODUCTS (checks both id and slug)
  FOR rec IN
    SELECT * FROM (
      VALUES
        (v_p1, v_cat_silk, v_brand_kanchi, v_chart_women, 'Royal Kanjivaram Gold Zari Silk Saree', 'royal-kanjivaram-gold-zari-silk-saree', 'Handcrafted pure silk saree with opulent golden zari motifs, contrast pallu and heavy borders. Ideal for weddings and premium cultural festivities.', 'Pure Mulberry Silk with Gold Zari', 'Traditional Drape', 'Temple Zari Border', 'Wedding & Festive', 'women', '5007', 5.00, 6999.00, 4499.00, 10),
        (v_p2, v_cat_silk, v_brand_varanasi, v_chart_women, 'Banarasi Brocade Weave Saree', 'banarasi-brocade-weave-saree', 'Traditional Banarasi handloom saree featuring intricate floral jaal weaving, lustrous finish and matching unstitched blouse piece.', 'Katan Silk Brocade', 'Traditional Drape', 'Floral Jaal Brocade', 'Bridal & Reception', 'women', '5007', 5.00, 5499.00, 3899.00, 10),
        (v_p3, v_cat_cotton, v_brand_giza, v_chart_men, 'Luxury 60s Giza Cotton Shirting (2.5m Cut)', 'luxury-60s-giza-cotton-shirting', 'Egyptian long-staple Giza cotton with satin finish and feather-soft feel. Breathable weave tailored for bespoke formal shirts.', '100% Giza Egyptian Cotton', 'Unstitched Tailored Cut', 'Solid Fine Twill', 'Corporate & Formal', 'men', '5208', 5.00, 1999.00, 1299.00, 20),
        (v_p4, v_cat_cotton, v_brand_giza, v_chart_men, 'Executive Oxford Textured Suiting (3m Cut)', 'executive-oxford-textured-suiting', 'High-twist wrinkle-resistant fabric blend crafted for luxury suits, blazers, and corporate trousers.', 'Wool & Poly-Viscose Blend', 'Unstitched Suit Cut', 'Micro Oxford Weave', 'Business & Ceremonial', 'men', '5515', 5.00, 3499.00, 2199.00, 15),
        (v_p5, v_cat_kurti, v_brand_jaipur, v_chart_women, 'Embroidered Chanderi Festive Kurti', 'embroidered-chanderi-festive-kurti', 'Elegant straight-cut ethnic kurti embellished with delicate gota patti hand embroidery along the neckline and sleeves.', 'Chanderi Silk Cotton', 'Straight Cut', 'Gota Patti Embroidered', 'Festive & Ethnic', 'women', '6204', 5.00, 2999.00, 1799.00, 15),
        (v_p6, v_cat_kurti, v_brand_jaipur, v_chart_women, 'Hand-Block Printed Anarkali Kurti', 'hand-block-printed-anarkali-kurti', 'Artisanal Bagru hand block print flared anarkali silhouette with potli buttons and contrast border piping.', 'Cambric Cotton', 'Flared Anarkali', 'Bagru Block Print', 'Daywear & Festive', 'women', '6204', 5.00, 2499.00, 1499.00, 20),
        (v_p7, v_cat_lehenga, v_brand_atelier, v_chart_women, 'Royal Crimson Velvet Bridal Lehenga', 'royal-crimson-velvet-bridal-lehenga', 'Magnificent velvet bridal lehenga set adorned with traditional dabka, sequins, and heavy zardozi handwork with cancan layer.', 'Micro Velvet & Net', 'Bridal Flared', 'Heavy Zardozi Embroidered', 'Bridal Trousseau', 'women', '6204', 12.00, 22999.00, 14999.00, 5),
        (v_p8, v_cat_lehenga, v_brand_atelier, v_chart_women, 'Pastel Peach Organza Floral Lehenga', 'pastel-peach-organza-floral-lehenga', 'Dreamy organza lehenga with subtle metallic resham embroidery and delicate scalloped borders. Designed for receptions and sangeet.', 'Silk Organza', 'Layered Flared', 'Floral Resham', 'Sangeet & Reception', 'women', '6204', 12.00, 15999.00, 9999.00, 5),
        (v_p9, v_cat_linen, v_brand_giza, v_chart_men, 'Pure European Flax Linen (Per Meter)', 'pure-european-flax-linen-meter', 'Unprocessed natural raw flax linen fabric. Eco-dyed, hypoallergenic, and perfect for resort shirts, dresses, and home curtains.', '100% Pure Flax Linen (60 Lea)', 'Running Meter Roll', 'Natural Slub Plain', 'Resort & Summer Tailoring', 'unisex', '5309', 5.00, 1499.00, 899.00, 30),
        (v_p10, v_cat_linen, v_brand_atelier, NULL, 'Handspun Tussar Raw Silk (Per Meter)', 'handspun-tussar-raw-silk-meter', 'Heritage natural gold tussar wild silk with textured slub grain. Handloom certified with natural sheen.', '100% Wild Tussar Silk', 'Running Meter Roll', 'Textured Raw Slub', 'Bespoke Couture', 'unisex', '5007', 5.00, 1899.00, 1150.00, 25)
    ) AS p(pid, pcat, pbrand, pchart, pname, pslug, pdesc, pfabric, pfit, ppattern, poccasion, paudience, phsn, pgst, pmrp, pretail, pmoq)
  LOOP
    SELECT id INTO v_existing_id FROM public.products WHERE id = rec.pid OR slug = rec.pslug LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      UPDATE public.products
      SET
        shop_id = v_house_shop_id,
        category_id = rec.pcat,
        brand_id = rec.pbrand,
        size_chart_id = rec.pchart,
        name = rec.pname,
        description = rec.pdesc,
        fabric = rec.pfabric,
        fit = rec.pfit,
        pattern = rec.ppattern,
        occasion = rec.poccasion,
        audience = rec.paudience,
        hsn_code = rec.phsn,
        gst_rate = rec.pgst,
        mrp = rec.pmrp,
        retail_price = rec.pretail,
        b2b_moq = rec.pmoq,
        sell_retail = true,
        sell_b2b = true,
        approval_status = 'approved',
        is_active = true
      WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.products (id, shop_id, category_id, brand_id, size_chart_id, name, slug, description, fabric, fit, pattern, occasion, audience, hsn_code, gst_rate, mrp, retail_price, b2b_moq, sell_retail, sell_b2b, approval_status, is_active)
      VALUES (rec.pid, v_house_shop_id, rec.pcat, rec.pbrand, rec.pchart, rec.pname, rec.pslug, rec.pdesc, rec.pfabric, rec.pfit, rec.ppattern, rec.poccasion, rec.paudience, rec.phsn, rec.pgst, rec.pmrp, rec.pretail, rec.pmoq, true, true, 'approved', true);
    END IF;
  END LOOP;

  SELECT id INTO v_p1 FROM public.products WHERE id = v_p1 OR slug = 'royal-kanjivaram-gold-zari-silk-saree' LIMIT 1;
  SELECT id INTO v_p2 FROM public.products WHERE id = v_p2 OR slug = 'banarasi-brocade-weave-saree' LIMIT 1;
  SELECT id INTO v_p3 FROM public.products WHERE id = v_p3 OR slug = 'luxury-60s-giza-cotton-shirting' LIMIT 1;
  SELECT id INTO v_p4 FROM public.products WHERE id = v_p4 OR slug = 'executive-oxford-textured-suiting' LIMIT 1;
  SELECT id INTO v_p5 FROM public.products WHERE id = v_p5 OR slug = 'embroidered-chanderi-festive-kurti' LIMIT 1;
  SELECT id INTO v_p6 FROM public.products WHERE id = v_p6 OR slug = 'hand-block-printed-anarkali-kurti' LIMIT 1;
  SELECT id INTO v_p7 FROM public.products WHERE id = v_p7 OR slug = 'royal-crimson-velvet-bridal-lehenga' LIMIT 1;
  SELECT id INTO v_p8 FROM public.products WHERE id = v_p8 OR slug = 'pastel-peach-organza-floral-lehenga' LIMIT 1;
  SELECT id INTO v_p9 FROM public.products WHERE id = v_p9 OR slug = 'pure-european-flax-linen-meter' LIMIT 1;
  SELECT id INTO v_p10 FROM public.products WHERE id = v_p10 OR slug = 'handspun-tussar-raw-silk-meter' LIMIT 1;

  -- 5. PRODUCT VARIANTS (constraint-free idempotent insert)
  INSERT INTO public.product_variants (product_id, size, color, sku, stock_qty)
  SELECT v.product_id, v.size, v.color, v.sku, v.stock_qty
  FROM (
    VALUES
      (v_p1, 'Free Size (6.3m)', 'Royal Crimson & Gold', 'TD-SK-001-RED', 45),
      (v_p1, 'Free Size (6.3m)', 'Emerald Green & Gold', 'TD-SK-001-GRN', 30),
      (v_p1, 'Free Size (6.3m)', 'Royal Navy Blue', 'TD-SK-001-BLU', 25),
      (v_p2, 'Free Size (6.3m)', 'Gold Ochre & Maroon', 'TD-BN-002-GLD', 40),
      (v_p2, 'Free Size (6.3m)', 'Wine Purple', 'TD-BN-002-WINE', 20),
      (v_p3, '2.5 Meter Cut', 'Pristine White', 'TD-CT-003-WHT', 150),
      (v_p3, '2.5 Meter Cut', 'Sky Blue', 'TD-CT-003-BLU', 120),
      (v_p3, '2.5 Meter Cut', 'Soft Pink', 'TD-CT-003-PNK', 80),
      (v_p4, '3 Meter Cut', 'Charcoal Grey', 'TD-ST-004-GRY', 90),
      (v_p4, '3 Meter Cut', 'Midnight Black', 'TD-ST-004-BLK', 110),
      (v_p5, 'M (38)', 'Mustard Gold', 'TD-KT-005-M', 60),
      (v_p5, 'L (40)', 'Mustard Gold', 'TD-KT-005-L', 50),
      (v_p5, 'XL (42)', 'Mustard Gold', 'TD-KT-005-XL', 40),
      (v_p6, 'M (38)', 'Indigo Blue', 'TD-AN-006-M', 55),
      (v_p6, 'L (40)', 'Indigo Blue', 'TD-AN-006-L', 45),
      (v_p7, 'Custom Semi-Stitched', 'Crimson Ruby', 'TD-LH-007-CRM', 12),
      (v_p8, 'Custom Semi-Stitched', 'Pastel Peach', 'TD-LH-008-PCH', 15),
      (v_p9, 'Per Meter', 'Natural Oatmeal', 'TD-LN-009-OAT', 300),
      (v_p10, 'Per Meter', 'Raw Beige Gold', 'TD-TS-010-BG', 250)
  ) AS v(product_id, size, color, sku, stock_qty)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.product_variants pv
    WHERE pv.sku = v.sku OR (pv.product_id = v.product_id AND pv.size = v.size AND pv.color = v.color)
  );

  -- 6. PRICE SLABS (B2B Volume Discounts - constraint-free idempotent insert)
  INSERT INTO public.price_slabs (product_id, min_qty, unit_price)
  SELECT s.product_id, s.min_qty, s.unit_price
  FROM (
    VALUES
      (v_p1, 10, 2999.00), (v_p1, 50, 2699.00), (v_p1, 100, 2399.00),
      (v_p2, 10, 2599.00), (v_p2, 50, 2299.00),
      (v_p3, 20, 750.00), (v_p3, 100, 650.00),
      (v_p4, 15, 1350.00), (v_p4, 60, 1199.00),
      (v_p5, 20, 999.00), (v_p5, 100, 849.00),
      (v_p6, 20, 799.00),
      (v_p7, 5, 10999.00),
      (v_p8, 5, 7499.00),
      (v_p9, 30, 550.00), (v_p9, 150, 480.00),
      (v_p10, 30, 690.00), (v_p10, 150, 599.00)
  ) AS s(product_id, min_qty, unit_price)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.price_slabs ps
    WHERE ps.product_id = s.product_id AND ps.min_qty = s.min_qty
  );

  -- 7. PRODUCT IMAGES (idempotent insert)
  INSERT INTO public.product_images (product_id, url, sort_order, is_cover)
  SELECT i.product_id, i.url, i.sort_order, i.sort_order = 1
  FROM (
    VALUES
      (v_p1, 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=80', 1),
      (v_p1, 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=900&q=80', 2),
      (v_p2, 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=900&q=80', 1),
      (v_p3, 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=80', 1),
      (v_p4, 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?auto=format&fit=crop&w=900&q=80', 1),
      (v_p5, 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=900&q=80', 1),
      (v_p6, 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=900&q=80', 1),
      (v_p7, 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=900&q=80', 1),
      (v_p8, 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=900&q=80', 1),
      (v_p9, 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=900&q=80', 1),
      (v_p10, 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&w=900&q=80', 1)
  ) AS i(product_id, url, sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.product_images pi
    WHERE pi.product_id = i.product_id AND pi.url = i.url
  );

  -- 8. LAUNCH COUPONS (idempotent insert)
  INSERT INTO public.coupons (code, discount_type, discount_value, min_order_value, max_discount, usage_limit, times_used, valid_from, valid_to, is_active)
  SELECT c.code, c.discount_type, c.discount_value, c.min_order_value, c.max_discount, c.usage_limit, 0, now(), c.valid_to, true
  FROM (
    VALUES
      ('TRIOFIRST10', 'percentage', 10.00, 1000.00, 500.00, 500, now() + interval '365 days'),
      ('B2BBULK50', 'fixed', 2500.00, 30000.00, 2500.00, 200, now() + interval '365 days'),
      ('FESTIVE15', 'percentage', 15.00, 5000.00, 1500.00, 300, now() + interval '180 days')
  ) AS c(code, discount_type, discount_value, min_order_value, max_discount, usage_limit, valid_to)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.coupons cp WHERE cp.code = c.code
  );

  -- 9. SAMPLE HERO BANNER & FLASH SALE (idempotent)
  INSERT INTO public.banners (title, subtitle, image_url, cta_label, cta_href, placement, sort_order, is_active)
  SELECT
    'Handloom Silks & Mill-Direct Suiting',
    'Curated Kanjivaram, Banarasi, 60s Giza Cotton, and wholesale B2B lots sourced directly from verified Indian textile houses.',
    'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=80',
    'Explore Full Catalog',
    '/catalog',
    'hero',
    1,
    true
  WHERE NOT EXISTS (SELECT 1 FROM public.banners WHERE placement = 'hero');

  INSERT INTO public.flash_sales (title, product_id, discount_percent, starts_at, ends_at, is_active)
  SELECT
    'Festive Kanjivaram Guild Offer',
    v_p1,
    12,
    now() - interval '1 hour',
    now() + interval '7 days',
    true
  WHERE v_p1 IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.flash_sales WHERE product_id = v_p1);

  -- 10. SAMPLE SERVICEABLE PINCODES (idempotent)
  INSERT INTO public.service_areas (pincode, city, state, cod_available, estimated_days, shipping_charge, is_serviceable)
  SELECT sa.pincode, sa.city, sa.state, sa.cod_available, sa.estimated_days, sa.shipping_charge, true
  FROM (
    VALUES
      ('395002', 'Surat', 'Gujarat', true, 2, 0.00),
      ('400001', 'Mumbai', 'Maharashtra', true, 3, 0.00),
      ('110001', 'New Delhi', 'Delhi', true, 4, 150.00),
      ('600001', 'Chennai', 'Tamil Nadu', true, 4, 150.00),
      ('560001', 'Bengaluru', 'Karnataka', true, 4, 150.00)
  ) AS sa(pincode, city, state, cod_available, estimated_days, shipping_charge)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.service_areas existing WHERE existing.pincode = sa.pincode
  );

END $$;
