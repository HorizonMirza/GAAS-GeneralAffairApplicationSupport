#!/usr/bin/env bash
# Wipes all transaction data across every module (keeps user accounts intact) and clears the
# per-module upload folders whose file names/paths are tied to the now-reset auto-increment ids.
#
# Usage: ./resetdb.sh
# Reads connection info from PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD if set, otherwise falls
# back to this project's local dev defaults (see backend/appsettings.Example.json).
set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-pengiriman_barang}"
PGUSER="${PGUSER:-pengiriman_app}"
export PGHOST PGPORT PGDATABASE PGUSER
[ -n "${PGPASSWORD:-}" ] && export PGPASSWORD

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

read -r -p "This deletes ALL transaction data in '${PGDATABASE}' on ${PGHOST}:${PGPORT} (accounts are kept). Continue? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Cancelled."
    exit 0
fi

psql -f "${SCRIPT_DIR}/resetdb.sql"

BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
for dir in "${BACKEND_DIR}/uploads/invoices" "${BACKEND_DIR}/uploads/sarana" "${BACKEND_DIR}/uploads/profile-photos"; do
    if [ -d "$dir" ]; then
        find "$dir" -mindepth 1 -delete
    fi
done

echo "Done. All transaction data cleared, accounts untouched, uploaded files removed."
