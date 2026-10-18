-- Prisma SQLite attend des DateTime ISO (…T…Z), pas "YYYY-MM-DD HH:MM:SS".
UPDATE "home_videos"
SET
  "createdAt" = CASE
    WHEN instr("createdAt", 'T') = 0 THEN replace("createdAt", ' ', 'T') || '.000Z'
    ELSE "createdAt"
  END,
  "updatedAt" = CASE
    WHEN instr("updatedAt", 'T') = 0 THEN replace("updatedAt", ' ', 'T') || '.000Z'
    ELSE "updatedAt"
  END;
