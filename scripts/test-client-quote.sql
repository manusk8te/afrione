BEGIN;
DO $$
DECLARE mid uuid; sid uuid; uid uuid:='b4bfc249-db93-4fa0-83a6-3cf4ba951e3a'; q jsonb; receipt jsonb; again jsonb;
BEGIN
 INSERT INTO public.missions(client_id,category,status,total_price) VALUES(uid,'Plomberie','diagnostic',10000) RETURNING id INTO mid;
 INSERT INTO public.diagnostics(mission_id,ai_summary,raw_text,items_needed) VALUES(mid,'TEST TRANSACTION ROLLBACK','{"is_test":true}',ARRAY['Produit fixture']);
 INSERT INTO public.diagnostic_product_selections(mission_id,item,query,quantity,offer,selected_by) VALUES(mid,'Produit fixture','Produit fixture',2,jsonb_build_object('name','Produit fixture','price',5000,'unit','article','currency','XOF','source_url','https://merchant.example/fixture','observed_at',now()),uid) RETURNING id INTO sid;
 q:=public.get_client_quote(mid,uid);
 IF q->>'total' IS NOT NULL THEN RAISE EXCEPTION 'unresolved product incorrectly payable'; END IF;
 UPDATE public.diagnostic_product_selections SET billing_mode='included' WHERE id=sid;
 q:=public.get_client_quote(mid,uid);IF (q->>'total')::int<>10000 THEN RAISE EXCEPTION 'double counted included product'; END IF;
 UPDATE public.diagnostic_product_selections SET billing_mode='client_supplied' WHERE id=sid;
 q:=public.get_client_quote(mid,uid);IF (q->>'total')::int<>10000 THEN RAISE EXCEPTION 'double counted client product'; END IF;
 UPDATE public.diagnostic_product_selections SET billing_mode='additional' WHERE id=sid;
 q:=public.get_client_quote(mid,uid);IF q->>'total' IS NOT NULL THEN RAISE EXCEPTION 'unconfirmed extra payable'; END IF;
 UPDATE public.diagnostic_product_selections SET unit_confirmed=true,exclusion_confirmed=true WHERE id=sid;
 q:=public.get_client_quote(mid,uid);IF (q->>'total')::int<>20000 OR (q->>'materials_total')::int<>10000 THEN RAISE EXCEPTION 'quantity or total wrong'; END IF;
 BEGIN PERFORM public.simulate_client_payment(mid,uid,19999);RAISE EXCEPTION 'missing wrong amount rejection';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%quote_changed%' THEN RAISE; END IF;END;
 BEGIN PERFORM public.simulate_client_payment_v2(mid,uid,20000,'00000000000000000000000000000000');RAISE EXCEPTION 'missing revision check';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%quote_changed%' THEN RAISE;END IF;END;
 receipt:=public.simulate_client_payment_v2(mid,uid,20000,q->>'quote_revision');again:=public.simulate_client_payment(mid,uid,20000);
 IF receipt->>'id'<>again->>'id' OR (receipt->>'amount')::int<>20000 OR jsonb_array_length(receipt->'quote_snapshot'->'quote'->'selected_products')<>1 THEN RAISE EXCEPTION 'receipt not stable'; END IF;
 BEGIN UPDATE public.diagnostic_product_selections SET quantity=3 WHERE id=sid;RAISE EXCEPTION 'missing selection freeze';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%quote_already_simulated%' THEN RAISE;END IF;END;
 BEGIN UPDATE public.missions SET total_price=12000 WHERE id=mid;RAISE EXCEPTION 'missing service price freeze';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%quote_already_simulated%' THEN RAISE;END IF;END;
 INSERT INTO public.missions(client_id,category,status) VALUES(uid,'Menuiserie','diagnostic') RETURNING id INTO mid;
 INSERT INTO public.quote_requests(mission_id,client_id,notes) VALUES(mid,uid,'TEST devis sans prix');
 q:=public.get_client_quote(mid,uid);IF q->>'total' IS NOT NULL OR (q->>'needs_quote')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'unknown price payable';END IF;
END $$;
ROLLBACK;
SELECT 'PASS: no double-count, explicit extras, receipt idempotency/freeze, quote without price; fixtures rolled back' AS result;
