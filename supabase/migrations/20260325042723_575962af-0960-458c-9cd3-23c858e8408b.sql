
-- Step 1: Insert 100 products (women's clothing) with variants
DO $$
DECLARE
  cat_ids uuid[] := ARRAY[
    '48869feb-e317-4e27-8764-a0ee8e80fb4c',
    '30400f12-dbb3-4b9b-8887-82c3d661c87f',
    '1c59c653-067a-45e1-8dd5-33883f71cbef',
    '13620878-9aa2-413f-afee-f7175c6ca9ca'
  ];
  product_names text[] := ARRAY[
    'Silk Saree','Cotton Kurti','Chiffon Dupatta','Palazzo Pants','Anarkali Suit',
    'Lehenga Choli','Banarasi Saree','Churidar Set','Embroidered Blouse','Georgette Saree',
    'Printed Maxi Dress','Chanderi Suit','Kalamkari Saree','Bandhani Dupatta','Tussar Silk Saree',
    'Cotton Salwar','Organza Saree','Patola Saree','Jacquard Kurti','Linen Saree',
    'Crepe Blouse','Brocade Lehenga','Handloom Saree','Designer Kurti','Kanjeevaram Saree',
    'Lawn Suit','Sharara Set','Peplum Top','A-Line Kurti','Straight Pants'
  ];
  colors text[] := ARRAY['Red','Blue','Green','Yellow','Pink','Purple','Orange','Maroon','Navy','Teal',
    'Coral','Magenta','Ivory','Peach','Lavender','Mint','Gold','Silver','Cream','Black'];
  prices int[] := ARRAY[499,699,899,999,1299,1499,1999,2499,2999,3499,4999];
  sizes text[] := ARRAY['XS','S','M','L','XL','XXL','Free Size'];
  pid uuid; pname text; pslug text; pprice int; i int; j int; nv int; vid uuid; vprice int;
BEGIN
  FOR i IN 1..100 LOOP
    pid := gen_random_uuid();
    pname := colors[1 + floor(random()*20)::int] || ' ' || product_names[1 + floor(random()*30)::int] || ' ' || i;
    pslug := lower(replace(replace(pname, ' ', '-'), '#', '')) || '-' || left(pid::text,6);
    pprice := prices[1 + floor(random()*11)::int];
    INSERT INTO products (id,name,slug,description,short_description,category_id,price,cost_price,stock_quantity,low_stock_threshold,tax_rate,is_active,is_featured,is_bestseller,sort_order,variant_required,created_at)
    VALUES (pid,pname,pslug,'Beautiful women''s clothing. Premium quality.',pname,cat_ids[1+floor(random()*4)::int],pprice,pprice/2,floor(random()*200)::int,5,5,true,random()<0.15,random()<0.15,i,true,now()-(floor(random()*180)::int||' days')::interval);
    nv := 2 + floor(random()*4)::int;
    FOR j IN 1..nv LOOP
      vid := gen_random_uuid(); vprice := prices[1+floor(random()*11)::int];
      INSERT INTO product_variants (id,product_id,name,sku,price,cost_price,stock_quantity,tax_rate,is_active,sort_order,attributes)
      VALUES (vid,pid,sizes[1+((j-1)%7)],'SKU-'||left(pid::text,4)||'-'||j,vprice,vprice/2,floor(random()*50)::int,5,true,j-1,jsonb_build_object('size',sizes[1+((j-1)%7)]));
    END LOOP;
  END LOOP;
END $$;

-- Step 2: Insert 1000 orders + items + payments + deliveries + returns + expenses
-- Using existing user_ids from profiles table
DO $$
DECLARE
  user_ids uuid[];
  prod_ids uuid[];
  var_ids uuid[];
  pay_methods text[] := ARRAY['online','cod'];
  cities text[] := ARRAY['Mumbai','Delhi','Bangalore','Chennai','Kolkata','Hyderabad','Pune','Ahmedabad','Jaipur','Lucknow'];
  states_arr text[] := ARRAY['Maharashtra','Delhi','Karnataka','Tamil Nadu','West Bengal','Telangana','Maharashtra','Gujarat','Rajasthan','Uttar Pradesh'];
  streets text[] := ARRAY['MG Road','Station Road','Temple Street','Market Lane','Park Avenue'];
  partners text[] := ARRAY['Delhivery','BlueDart','DTDC','Ekart','Shadowfax','Ecom Express'];
  reasons text[] := ARRAY['Defective product','Wrong size','Color mismatch','Not as described','Changed mind','Late delivery'];
  expense_cats text[] := ARRAY['ads','packaging','delivery','staff','rent','utilities','software','other'];
  expense_descs text[] := ARRAY['Facebook Ads','Boxes 100pc','Courier charges','Staff salary','Warehouse rent','Electricity bill','Supabase plan','Office supplies'];
  
  oid uuid; ostatus text; pstatus text; pmethod text;
  subtotal int; discount int; tax int; shipping int; total int;
  city_idx int; created_ts timestamptz;
  i int; j int; num_items int; iprice int; iqty int; rand_val float; dstatus text;
  uid uuid;
BEGIN
  SELECT array_agg(user_id) INTO user_ids FROM profiles;
  SELECT array_agg(id) INTO prod_ids FROM products WHERE is_active = true;
  SELECT array_agg(id) INTO var_ids FROM product_variants WHERE is_active = true;

  IF user_ids IS NULL OR array_length(user_ids,1) IS NULL THEN
    RAISE EXCEPTION 'No users found in profiles';
  END IF;

  FOR i IN 1..1000 LOOP
    oid := gen_random_uuid();
    rand_val := random();
    IF rand_val < 0.10 THEN ostatus := 'new';
    ELSIF rand_val < 0.25 THEN ostatus := 'confirmed';
    ELSIF rand_val < 0.35 THEN ostatus := 'packed';
    ELSIF rand_val < 0.50 THEN ostatus := 'shipped';
    ELSIF rand_val < 0.90 THEN ostatus := 'delivered';
    ELSIF rand_val < 0.95 THEN ostatus := 'cancelled';
    ELSE ostatus := 'returned'; END IF;
    
    IF ostatus IN ('confirmed','packed','shipped','delivered') THEN pstatus := 'paid';
    ELSIF ostatus = 'cancelled' THEN pstatus := 'failed';
    ELSE pstatus := (ARRAY['pending','paid'])[1+floor(random()*2)::int]; END IF;
    
    pmethod := pay_methods[1+floor(random()*2)::int];
    subtotal := 500 + floor(random()*14500)::int;
    discount := floor(random()*subtotal*0.2)::int;
    tax := floor(subtotal*0.05)::int;
    shipping := CASE WHEN subtotal > 999 THEN 0 ELSE (ARRAY[49,79,99])[1+floor(random()*3)::int] END;
    total := subtotal - discount + tax + shipping;
    city_idx := 1 + floor(random()*10)::int;
    created_ts := now() - (floor(random()*180)::int||' days')::interval;
    uid := user_ids[1+floor(random()*array_length(user_ids,1))::int];
    
    INSERT INTO orders (id,order_number,user_id,status,payment_status,payment_method,subtotal,discount,tax,shipping_charge,total,shipping_address,created_at)
    VALUES (oid,'ORD'||to_char(created_ts,'YYYYMMDD')||lpad(i::text,4,'0'),uid,ostatus::order_status,pstatus::payment_status,pmethod::payment_method,
      subtotal,discount,tax,shipping,total,
      jsonb_build_object('full_name','Customer '||i,'mobile_number','+919'||lpad(floor(random()*100000000)::text,8,'0'),
        'address_line1',floor(random()*500)::text||', '||streets[1+floor(random()*5)::int],
        'city',cities[city_idx],'state',states_arr[city_idx],'pincode',lpad(floor(random()*900000+100000)::text,6,'0')),
      created_ts);
    
    num_items := 1 + floor(random()*4)::int;
    FOR j IN 1..num_items LOOP
      iprice := (ARRAY[499,699,899,1299,1999,2499])[1+floor(random()*6)::int];
      iqty := 1 + floor(random()*3)::int;
      INSERT INTO order_items (order_id,product_id,variant_id,product_name,variant_name,price,quantity,total)
      VALUES (oid,prod_ids[1+floor(random()*array_length(prod_ids,1))::int],var_ids[1+floor(random()*array_length(var_ids,1))::int],
        'Product '||j,(ARRAY['S','M','L','XL','Free Size'])[1+floor(random()*5)::int],iprice,iqty,iprice*iqty);
    END LOOP;
    
    INSERT INTO payments (order_id,amount,method,status,transaction_id,created_at)
    VALUES (oid,total,pmethod::payment_method,pstatus::payment_status,
      CASE WHEN pstatus='paid' THEN 'TXN'||floor(random()*900000000+100000000)::text ELSE NULL END,created_ts);
    
    IF i <= 800 THEN
      rand_val := random();
      IF rand_val < 0.10 THEN dstatus := 'pending';
      ELSIF rand_val < 0.20 THEN dstatus := 'assigned';
      ELSIF rand_val < 0.30 THEN dstatus := 'picked';
      ELSIF rand_val < 0.50 THEN dstatus := 'in_transit';
      ELSIF rand_val < 0.95 THEN dstatus := 'delivered';
      ELSE dstatus := 'failed'; END IF;
      INSERT INTO deliveries (order_id,status,partner_name,tracking_number,delivery_charge,is_cod,cod_amount,cod_collected,estimated_date,delivered_at,created_at)
      VALUES (oid,dstatus::delivery_status,partners[1+floor(random()*6)::int],
        CASE WHEN dstatus!='pending' THEN 'TR'||floor(random()*90000000000+10000000000)::bigint::text ELSE NULL END,
        (ARRAY[0,49,79,99])[1+floor(random()*4)::int],pmethod='cod',CASE WHEN pmethod='cod' THEN total ELSE NULL END,
        pmethod='cod' AND dstatus='delivered' AND random()<0.9,
        now()+(floor(random()*7)::int||' days')::interval,
        CASE WHEN dstatus='delivered' THEN now()-(floor(random()*30)::int||' days')::interval ELSE NULL END,created_ts);
    END IF;
    
    IF i <= 150 THEN
      rand_val := random();
      IF rand_val < 0.20 THEN dstatus := 'requested';
      ELSIF rand_val < 0.35 THEN dstatus := 'approved';
      ELSIF rand_val < 0.45 THEN dstatus := 'in_transit';
      ELSIF rand_val < 0.55 THEN dstatus := 'received';
      ELSIF rand_val < 0.75 THEN dstatus := 'refunded';
      ELSIF rand_val < 0.95 THEN dstatus := 'completed';
      ELSE dstatus := 'rejected'; END IF;
      INSERT INTO returns (order_id,user_id,return_number,reason,status,item_condition,created_at)
      VALUES (oid,uid,'RET'||to_char(created_ts,'YYYYMMDD')||lpad(i::text,4,'0'),
        reasons[1+floor(random()*6)::int],dstatus::return_status,
        (ARRAY['Good','Damaged','Used',NULL])[1+floor(random()*4)::int],created_ts);
    END IF;
  END LOOP;
  
  FOR i IN 1..300 LOOP
    j := 1 + floor(random()*8)::int;
    INSERT INTO expenses (category,description,amount,date,notes,created_at)
    VALUES (expense_cats[j]::expense_category,expense_descs[j]||' '||i,
      (ARRAY[500,1000,2000,3500,5000,7500,10000,15000,25000,50000])[1+floor(random()*10)::int],
      (now()-(floor(random()*180)::int||' days')::interval)::date,
      (ARRAY[NULL,'Monthly recurring','One-time','Quarterly'])[1+floor(random()*4)::int],
      now()-(floor(random()*180)::int||' days')::interval);
  END LOOP;
END $$;
