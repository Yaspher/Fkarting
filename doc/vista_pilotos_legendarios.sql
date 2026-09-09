-- Ejecutar cuando Supabase vuelva a estar disponible.
-- Expone las mismas columnas que vista_piloto y solo pilotos con WDC,
-- victorias o podios históricos.

CREATE OR REPLACE VIEW public.vista_pilotos_legendarios AS
SELECT *
FROM public.vista_piloto
WHERE COALESCE("Campeonato", 0) > 0
   OR COALESCE("Victorias", 0) > 0
   OR COALESCE("Podios", 0) > 0;
