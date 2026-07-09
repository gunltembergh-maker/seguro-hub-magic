
CREATE POLICY "lavoro_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lavoro'
         AND (public.has_role(auth.uid(),'ADMIN')
              OR public.pode_importar(auth.uid(),'gerencial')
              OR public.pode_importar(auth.uid(),'caixa')));

CREATE POLICY "lavoro_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lavoro'
              AND (public.has_role(auth.uid(),'ADMIN')
                   OR public.pode_importar(auth.uid(),'gerencial')
                   OR public.pode_importar(auth.uid(),'caixa')));

CREATE POLICY "lavoro_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'lavoro' AND public.has_role(auth.uid(),'ADMIN'));
