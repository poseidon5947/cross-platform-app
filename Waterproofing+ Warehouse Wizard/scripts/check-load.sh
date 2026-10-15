#!/usr/bin/env bash
# Loads every table loadRemoteState reads, with the exact ordering the code uses.
#
# A table with no created_at column 400s on the default ordering, read() throws,
# and Promise.all rejects - so one missing column takes the whole app down for
# every user while the bundle still looks correct. That is how the tool sat
# broken for two days in October: the deploy was checked by grepping the bundle
# for a string instead of loading anything.
#
# Run from the app directory after any migration that adds a table.
set -uo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "no .env here"; exit 2; }
set -a; . ./.env; set +a

declare -A ORD=(
  [daily_logs]=date [maintenance_request]=requested_at [points_events]=ts
  [task_completions]=completed_at [transactions]=ts [truck_logs]=ts
)

tables=$(grep -oE 'read\("[a-z_]+"' src/data/repo.ts | sed 's/read("//;s/"//' | sort -u)
fail=0
for t in $tables; do
  o=${ORD[$t]:-created_at}
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 25 \
    "$VITE_SUPABASE_URL/rest/v1/$t?select=*&order=$o.asc&limit=1" \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY")
  if [ "$code" = "200" ]; then
    printf '  ok    %-22s order=%s\n' "$t" "$o"
  else
    printf '  FAIL  %-22s order=%s -> HTTP %s\n' "$t" "$o" "$code"; fail=1
  fi
done
[ $fail -eq 0 ] && echo "app state loads" || echo "APP WILL NOT LOAD - fix before claiming a deploy is good"
exit $fail
