#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${FIREBASE_PROJECT_ID:-lyyuan03-membership}"
BASE_URL="https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents"
ACCESS_TOKEN="$(gcloud auth print-access-token)"
PAGE_TOKEN=""
NORMALIZED_COUNT=0

normalize_timestamp() {
  local raw="$1"
  date -u -d "$raw" +"%Y-%m-%dT%H:%M:%S.%3NZ"
}

while true; do
  RESPONSE_FILE="$(mktemp)"
  if [[ -n "$PAGE_TOKEN" ]]; then
    curl --silent --show-error --fail \
      --get \
      --header "Authorization: Bearer $ACCESS_TOKEN" \
      --data-urlencode "pageSize=300" \
      --data-urlencode "pageToken=$PAGE_TOKEN" \
      "$BASE_URL/sponsorMemberAccess" > "$RESPONSE_FILE"
  else
    curl --silent --show-error --fail \
      --get \
      --header "Authorization: Bearer $ACCESS_TOKEN" \
      --data-urlencode "pageSize=300" \
      "$BASE_URL/sponsorMemberAccess" > "$RESPONSE_FILE"
  fi

  while IFS= read -r DOCUMENT; do
    [[ -n "$DOCUMENT" ]] || continue

    NAME="$(jq -r '.name' <<< "$DOCUMENT")"
    UPDATE_TIME="$(jq -r '.updateTime // ""' <<< "$DOCUMENT")"
    FIELDS="$(jq -c '.fields // {}' <<< "$DOCUMENT")"
    MEMBER_TYPE="$(jq -r '.memberType.stringValue // ""' <<< "$FIELDS")"
    [[ "$MEMBER_TYPE" == "sponsor-member" ]] || continue

    DOC_ID="${NAME##*/}"
    EMAIL="$(python3 - "$DOC_ID" <<'PY'
import sys
from urllib.parse import unquote
print(unquote(sys.argv[1]).strip().lower())
PY
)"

    MODIFIED="$FIELDS"
    MODIFIED="$(jq -c --arg email "$EMAIL" '
      .email = {stringValue: $email}
      | .wellnessAccess = {booleanValue: false}
      | .accessScope = {stringValue: "sponsor-paid-articles"}
      | .accessVersion = {integerValue: "2"}
    ' <<< "$MODIFIED")"

    STATUS="$(jq -r '.status.stringValue // ""' <<< "$MODIFIED")"
    PAYMENT_STATUS="$(jq -r '.paymentStatus.stringValue // ""' <<< "$MODIFIED")"
    if [[ "$STATUS" == "active" && "$PAYMENT_STATUS" == "paid" ]]; then
      MODIFIED="$(jq -c '.articleAccess = {booleanValue: true}' <<< "$MODIFIED")"
    fi

    for FIELD in firstJoinedAt startsAt expiresAt paidAt discountUsedAt; do
      RAW_DATE="$(jq -r --arg field "$FIELD" '.[$field].stringValue // empty' <<< "$MODIFIED")"
      [[ -n "$RAW_DATE" ]] || continue
      if ! TIMESTAMP_VALUE="$(normalize_timestamp "$RAW_DATE")"; then
        echo "Invalid sponsor member date: $EMAIL / $FIELD / $RAW_DATE" >&2
        exit 1
      fi
      MODIFIED="$(jq -c --arg field "$FIELD" --arg value "$TIMESTAMP_VALUE" '.[$field] = {timestampValue: $value}' <<< "$MODIFIED")"
    done

    ORIGINAL_SORTED="$(jq -S -c . <<< "$FIELDS")"
    MODIFIED_SORTED="$(jq -S -c . <<< "$MODIFIED")"
    [[ "$ORIGINAL_SORTED" != "$MODIFIED_SORTED" ]] || continue

    BODY_FILE="$(mktemp)"
    jq -n --arg name "$NAME" --argjson fields "$MODIFIED" '{name: $name, fields: $fields}' > "$BODY_FILE"

    HTTP_STATUS="$(curl --silent --show-error \
      --output /tmp/sponsor-member-patch-response.json \
      --write-out "%{http_code}" \
      --request PATCH \
      --header "Authorization: Bearer $ACCESS_TOKEN" \
      --header "Content-Type: application/json" \
      --data-binary @"$BODY_FILE" \
      "https://firestore.googleapis.com/v1/$NAME")"

    rm -f "$BODY_FILE"

    if [[ "$HTTP_STATUS" -lt 200 || "$HTTP_STATUS" -ge 300 ]]; then
      echo "Failed to normalize sponsor member: $EMAIL" >&2
      cat /tmp/sponsor-member-patch-response.json >&2
      exit 1
    fi

    NORMALIZED_COUNT=$((NORMALIZED_COUNT + 1))
    echo "Normalized sponsor paid-article member: $EMAIL${UPDATE_TIME:+ (source update: $UPDATE_TIME)}"
  done < <(jq -c '.documents[]?' "$RESPONSE_FILE")

  PAGE_TOKEN="$(jq -r '.nextPageToken // empty' "$RESPONSE_FILE")"
  rm -f "$RESPONSE_FILE"
  [[ -n "$PAGE_TOKEN" ]] || break
done

echo "Sponsor paid-article member normalization complete: $NORMALIZED_COUNT record(s) updated."
