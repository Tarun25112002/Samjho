-- Close a hole in the subject uniqueness key.
--
-- `@@unique([board, classLevel, code, variant])` compiles to a plain unique
-- index over four columns, one of which is nullable. Postgres treats NULL as
-- distinct from NULL, so that index does not constrain rows where `variant IS
-- NULL` at all: any number of (CBSE, 10, 'SCI', NULL) subjects may coexist.
--
-- That is not an edge case. Only Maths carries a variant (Basic vs Standard);
-- every other subject has NULL, so the intended constraint was inert for
-- essentially the whole catalogue. Two "Class 10 Science" rows would split its
-- chapters, questions, enrolments and progress across two ids that look
-- identical in every UI — and the split would be discovered by a student whose
-- subject list showed the same subject twice.
--
-- A partial unique index covers exactly the rows the four-column one misses.
-- Postgres 15's `NULLS NOT DISTINCT` would express this more directly, but a
-- partial index works on every version and needs no server-version check.
--
-- Prisma's schema language cannot express a partial index, so this lives in a
-- hand-written migration alongside the CHECK constraints from the initial
-- migration. The corresponding note is on the `Subject` model.
CREATE UNIQUE INDEX "subjects_board_classLevel_code_no_variant_key"
  ON "subjects" ("board", "classLevel", "code")
  WHERE "variant" IS NULL;
