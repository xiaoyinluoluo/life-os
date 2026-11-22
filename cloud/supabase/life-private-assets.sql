insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('life-private','life-private',false,5242880,
  array['image/png','image/jpeg','image/webp','font/ttf','font/otf','font/woff','font/woff2','application/font-woff','application/octet-stream'])
on conflict (id) do nothing;

create policy life_private_select on storage.objects for select to authenticated
 using (bucket_id='life-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy life_private_insert on storage.objects for insert to authenticated
 with check (bucket_id='life-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy life_private_update on storage.objects for update to authenticated
 using (bucket_id='life-private' and (storage.foldername(name))[1]=(select auth.uid())::text)
 with check (bucket_id='life-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy life_private_delete on storage.objects for delete to authenticated
 using (bucket_id='life-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
