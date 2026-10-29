BEGIN;
DO $$
DECLARE uid uuid:='b4bfc249-db93-4fa0-83a6-3cf4ba951e3a'; aid uuid; provider uuid; mid uuid; a jsonb; q jsonb;
BEGIN
 SELECT id,user_id INTO aid,provider FROM artisan_pros WHERE user_id<>uid LIMIT 1;
 IF provider IS NULL THEN RAISE EXCEPTION 'No separate provider fixture available'; END IF;
 INSERT INTO missions(client_id,artisan_id,category,status,total_price) VALUES(uid,aid,'Plomberie','diagnostic',10000) RETURNING id INTO mid;
 a:=update_discussion_agreement(mid,uid,'confirm',0,'{"scope":"Remplacer le robinet de cuisine, sans fourniture du robinet","discussion":true}');
 BEGIN PERFORM update_discussion_agreement(mid,uid,'propose',1,'{"scope":"Une prestation changée","reason":"Une justification complète","amount":12000,"supplies":"excluded"}'); RAISE EXCEPTION 'client improperly proposed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%réservé au prestataire%' THEN RAISE; END IF; END;
 a:=update_discussion_agreement(mid,provider,'propose',1,'{"scope":"Remplacer le robinet et les flexibles de cuisine","reason":"Les flexibles sont abîmés et doivent être changés","amount":12000,"supplies":"excluded"}');
 IF (SELECT total_price FROM missions WHERE id=mid)<>10000 THEN RAISE EXCEPTION 'Unapproved increase applied'; END IF;
 BEGIN PERFORM simulate_client_payment(mid,uid,10000); RAISE EXCEPTION 'Pending proposal payable'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%rectificatif en attente%' THEN RAISE; END IF; END;
 BEGIN PERFORM update_discussion_agreement(mid,uid,'accept',1,'{}'); RAISE EXCEPTION 'stale version accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Accord modifié%' THEN RAISE; END IF; END;
 a:=update_discussion_agreement(mid,uid,'accept',2,'{}');
 q:=get_client_quote(mid,uid);
 IF (q->>'total')::int<>12000 OR a->'pending'<>'null'::jsonb THEN RAISE EXCEPTION 'Accepted price not propagated'; END IF;
 a:=update_discussion_agreement(mid,provider,'propose',3,'{"scope":"Une prestation additionnelle encore non acceptée","reason":"Supplément à examiner par le client avant intervention","amount":15000,"supplies":"excluded"}');
 a:=update_discussion_agreement(mid,uid,'reject',4,'{}');
 IF (SELECT total_price FROM missions WHERE id=mid)<>12000 THEN RAISE EXCEPTION 'Refusal changed accepted price'; END IF;
 PERFORM simulate_client_payment(mid,uid,12000);
 BEGIN PERFORM update_discussion_agreement(mid,provider,'propose',5,'{"scope":"Une prestation changée après paiement","reason":"Une justification détaillée après la confirmation","amount":17000,"supplies":"excluded"}'); RAISE EXCEPTION 'Paid agreement editable'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%verrouillé%' THEN RAISE; END IF; END;
END $$;
SELECT 'PASS: client/provider roles, unchanged pending price, payment blocked pending agreement, stale versions, accepted price, refused increase, paid freeze; rollback' as result;
ROLLBACK;
