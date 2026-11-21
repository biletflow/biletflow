#!/usr/bin/env bash
# Attendee API smoke for demo rehearsal. Requires a reachable backend + seeded user.
# Usage:
#   BILETFLOW_API_URL=http://127.0.0.1:3000 \
#   DEMO_EMAIL=attendee1@example.kz DEMO_PASSWORD='...' \
#   ./tool/demo_attendee_api.sh
set -euo pipefail

base="${BILETFLOW_API_URL:?set BILETFLOW_API_URL}"
email="${DEMO_EMAIL:?set DEMO_EMAIL}"
password="${DEMO_PASSWORD:?set DEMO_PASSWORD}"
base="${base%/}"

jq_get() {
  python3 -c 'import json,sys; data=json.load(sys.stdin); print(eval("data"+sys.argv[1]))' "$1"
}

echo "== login =="
login="$(curl -fsS -X POST "$base/api/mobile/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$email\",\"password\":\"$password\"}")"
token="$(printf '%s' "$login" | jq_get "['token']")"
test -n "$token"

auth=(-H "authorization: Bearer $token" -H 'accept: application/json')

echo "== catalog =="
catalog="$(curl -fsS "${auth[@]}" "$base/api/events?sort=date&take=5")"
slug="$(printf '%s' "$catalog" | python3 -c 'import json,sys; events=json.load(sys.stdin)["events"]; print(events[0]["slug"] if events else "")')"
test -n "$slug"

echo "== event $slug =="
detail="$(curl -fsS "${auth[@]}" "$base/api/events/$slug")"
event_id="$(printf '%s' "$detail" | jq_get "['event']['id']")"
type_id="$(printf '%s' "$detail" | python3 -c 'import json,sys; types=json.load(sys.stdin)["event"]["ticketTypes"]; print(next(t["id"] for t in types if t.get("available",0)>0))')"

key="$(python3 -c 'import uuid; print(uuid.uuid4())')"
echo "== create order =="
created="$(curl -fsS -X POST "${auth[@]}" "$base/api/orders" \
  -H 'content-type: application/json' \
  -d "{\"eventId\":\"$event_id\",\"items\":[{\"ticketTypeId\":\"$type_id\",\"quantity\":1}],\"attendees\":[{\"fullName\":\"Demo Attendee\",\"email\":\"$email\"}],\"clientIdempotencyKey\":\"$key\"}")"
order_id="$(printf '%s' "$created" | jq_get "['order']['id']")"
status="$(printf '%s' "$created" | jq_get "['order']['status']")"
echo "order=$order_id status=$status"

if [ "$status" = "AWAITING_PAYMENT" ]; then
  echo "== pay + simulate APPROVED =="
  curl -fsS -X POST "${auth[@]}" "$base/api/orders/$order_id/pay" -H 'content-type: application/json' -d '{}' >/dev/null
  settled="$(curl -fsS -X POST "${auth[@]}" "$base/api/orders/$order_id/pay/simulate" \
    -H 'content-type: application/json' \
    -d '{"outcome":"APPROVED"}')"
  status="$(printf '%s' "$settled" | jq_get "['order']['status']")"
  echo "status=$status"
fi

echo "== tickets =="
tickets="$(curl -fsS "${auth[@]}" "$base/api/tickets")"
ticket_id="$(printf '%s' "$tickets" | python3 -c 'import json,sys; rows=json.load(sys.stdin)["tickets"]; print(rows[0]["id"] if rows else "")')"
test -n "$ticket_id"

echo "== qr + pdf =="
curl -fsS "${auth[@]}" -H 'accept: image/png' "$base/api/tickets/$ticket_id/qr.png" -o /tmp/biletflow-demo-qr.png
curl -fsS "${auth[@]}" -H 'accept: application/pdf' "$base/api/tickets/$ticket_id/pdf" -o /tmp/biletflow-demo-ticket.pdf
python3 - <<'PY'
from pathlib import Path
qr = Path('/tmp/biletflow-demo-qr.png').read_bytes()
pdf = Path('/tmp/biletflow-demo-ticket.pdf').read_bytes()
assert qr[:8] == bytes([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]), 'bad png'
assert pdf[:5] == b'%PDF-', 'bad pdf'
print('ok', len(qr), 'png bytes,', len(pdf), 'pdf bytes')
PY

echo "demo attendee API path succeeded"
