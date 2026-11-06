-- Move materials onto the date of the daily log they were filed with.
-- Each transaction was created within 0.02s of its log, same job, so the
-- pairing is the submit action itself, not a guess.
-- Clock time is kept at midday so nothing crosses a timezone boundary.

update transactions set ts = '2026-10-22T12:00:00+00:00' where id in ('71c23a4e-9d02-4512-838e-67c872a0aadf');  -- 1 rows
update transactions set ts = '2026-10-23T12:00:00+00:00' where id in ('b49f3200-f43a-47d0-8264-bea666701fe5','d7601ad0-7a1b-4e55-8ea2-fcb4b9e6b130','81dfc44f-124d-4626-b888-2a25cee59e11','726bf48b-43fe-486b-ae98-777257ac578f','22011c4f-1801-4ec8-9c1d-2b0125465aa1');  -- 5 rows
update transactions set ts = '2026-10-26T12:00:00+00:00' where id in ('55107d21-cc9d-45dd-80cd-60071e765367','d12802e9-0e8a-490e-9e76-b359bd1426ed','f34f8b94-cf36-47fb-b6e2-c74fcf46dc8f');  -- 3 rows
update transactions set ts = '2026-10-27T12:00:00+00:00' where id in ('fcced089-da59-4e63-b2da-10b65a423fc9','9fd5220e-bbb4-47d1-b0d9-2e842a5abca3');  -- 2 rows
update transactions set ts = '2026-10-28T12:00:00+00:00' where id in ('68163eec-7812-4df7-bfb4-59a756b7183e','dd9577ef-ec77-4ae6-bbba-f9070a8e1793');  -- 2 rows
update transactions set ts = '2026-10-30T12:00:00+00:00' where id in ('618a751a-8120-484d-b6c2-9c522d382e87','6ebcfceb-ae58-4347-a385-c4591a65be19','2f1f8a99-7e44-4f89-90ce-af4eb7c21d9e','f3a685d3-0ef2-4a83-9b8a-b87cb118fba6','f53d0438-2709-4c60-927b-74f94d2d7e98','e56c57b9-e548-4f02-8241-b4b6c0b293a8','be12aba5-05a2-4d0b-9a1b-9b10a21e7e8c','b466028d-e084-42c0-92ce-1e3e2ab24909','e67506be-1fdf-4b53-ac9e-4b81ab577aeb','96501e0f-8854-48f1-a018-355c824183c1','d9153753-6181-44bf-aa17-cfaef6601c79','0e64fc34-50b2-4485-8f66-2b9150d0a761');  -- 12 rows
update transactions set ts = '2026-11-02T12:00:00+00:00' where id in ('f956ddea-4ce1-48e9-bdc1-b45a9214e47e','fd065982-6987-4382-aaf5-500303e296ac','5799176d-fb38-4f80-874e-e9cc98ee36bc','1b2fe44f-cb62-4fd3-b802-c7934e61d085','53e036bf-58e8-4539-836e-92b78bf255a1','b2f5ac96-9531-43ff-a95b-d736779391ad','fc93bc04-628d-4751-9703-f69016bf58e5','65a87cb4-4d24-4470-a762-9c6e7231e94a','b34c3cb3-ff76-4253-95ec-5c8cc39418d7','8b3e75a0-d5f4-4120-8c4f-d23e1ea515aa','5650c876-db00-4733-8285-8f246667b7be','cc7cc2d3-6be7-4476-bed1-a3c4ec9d8bb7');  -- 12 rows
