-- Auto-generated: refresh_ranking.sql
-- Purpose: Recalculate and upsert championship ranking into the existing public.ranking table
-- Usage: Paste and run this script in Supabase SQL editor (execute as a DB owner / privileged role).

-- 1) Ensure unique index for ON CONFLICT (if missing)
CREATE UNIQUE INDEX IF NOT EXISTS ranking_campeonato_piloto_idx
ON public.ranking (id_campeonato, id_piloto);

-- 2) Function: refresh_ranking_for_campeonato(integer)
CREATE OR REPLACE FUNCTION public.refresh_ranking_for_campeonato(p_id_campeonato integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Aggregate by piloto for the given campeonato
  FOR rec IN
    SELECT
      r.id_piloto,
      SUM(COALESCE(r.res_puntos,0))                          AS puntos,
      COUNT(DISTINCT r.id_carrera)                           AS carreras_count,
      SUM(CASE WHEN r.res_posicion = 1 THEN 1 ELSE 0 END)     AS victorias,
      SUM(CASE WHEN r.res_posicion <= 3 THEN 1 ELSE 0 END)    AS podios
    FROM public.resultado r
    JOIN public.carrera  c ON r.id_carrera = c.id_carrera
    WHERE c.id_campeonato = p_id_campeonato
    GROUP BY r.id_piloto
  LOOP
    INSERT INTO public.ranking (id_campeonato, id_piloto, ran_puntos, ran_carreras, ran_victorias, ran_podios, ran_showranking)
    VALUES (p_id_campeonato, rec.id_piloto, rec.puntos, rec.carreras_count, rec.victorias, rec.podios, true)
    ON CONFLICT (id_campeonato, id_piloto)
    DO UPDATE SET
      ran_puntos = EXCLUDED.ran_puntos,
      ran_carreras = EXCLUDED.ran_carreras,
      ran_victorias = EXCLUDED.ran_victorias,
      ran_podios = EXCLUDED.ran_podios;
  END LOOP;

  -- Remove ranking rows for pilots that no longer have results in this campeonato
  DELETE FROM public.ranking rnk
  WHERE rnk.id_campeonato = p_id_campeonato
    AND rnk.id_piloto NOT IN (
      SELECT DISTINCT res.id_piloto
      FROM public.resultado res
      JOIN public.carrera c2 ON res.id_carrera = c2.id_carrera
      WHERE c2.id_campeonato = p_id_campeonato
    );

  RETURN;
END;
$$;

-- 3) Trigger function: determine affected campeonato(s) and call refresher
CREATE OR REPLACE FUNCTION public.refresh_ranking_from_resultado_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_carreras integer[] := ARRAY[]::integer[];
  carrera_id integer;
  v_campeonato integer;
  distinct_carr_ids integer[];
BEGIN
  IF (TG_OP = 'INSERT') THEN
    affected_carreras := array_append(affected_carreras, NEW.id_carrera);
  ELSIF (TG_OP = 'DELETE') THEN
    affected_carreras := array_append(affected_carreras, OLD.id_carrera);
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.id_carrera IS DISTINCT FROM OLD.id_carrera THEN
      affected_carreras := array_append(affected_carreras, OLD.id_carrera);
      affected_carreras := array_append(affected_carreras, NEW.id_carrera);
    ELSE
      affected_carreras := array_append(affected_carreras, NEW.id_carrera);
    END IF;
  END IF;

  -- normalize: remove nulls and duplicates
  SELECT ARRAY_AGG(DISTINCT x) INTO distinct_carr_ids
  FROM unnest(affected_carreras) AS x
  WHERE x IS NOT NULL;

  IF distinct_carr_ids IS NULL THEN
    RETURN NULL;
  END IF;

  FOREACH carrera_id IN ARRAY distinct_carr_ids LOOP
    SELECT id_campeonato INTO v_campeonato FROM public.carrera WHERE id_carrera = carrera_id;
    IF v_campeonato IS NULL THEN
      CONTINUE;
    END IF;
    PERFORM public.refresh_ranking_for_campeonato(v_campeonato);
  END LOOP;

  RETURN NULL; -- AFTER trigger: return value ignored
END;
$$;

-- 4) Create AFTER trigger on resultado table
DROP TRIGGER IF EXISTS trg_refresh_ranking_after_resultado ON public.resultado;

CREATE TRIGGER trg_refresh_ranking_after_resultado
AFTER INSERT OR UPDATE OR DELETE ON public.resultado
FOR EACH ROW
EXECUTE FUNCTION public.refresh_ranking_from_resultado_trigger();

-- 5) Optional: populate initial rankings for all existing campeonatos
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT DISTINCT id_campeonato FROM public.carrera LOOP
    PERFORM public.refresh_ranking_for_campeonato(rec.id_campeonato);
  END LOOP;
END;
$$;

-- End of script
