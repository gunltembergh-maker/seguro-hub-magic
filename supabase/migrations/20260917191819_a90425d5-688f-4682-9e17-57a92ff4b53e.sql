CREATE POLICY "leitura_anexos_garantia_judicial"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'garantia-judicial-anexos'
  AND public.pode_ver_garantia_formulario()
);