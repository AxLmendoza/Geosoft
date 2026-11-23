#!/usr/bin/env bash
# Certificado HTTPS para probar GeoScript desde el celular en la red local (npm run dev:lan).
#
#   bash scripts/lan-cert.sh            # detecta la IP de la PC (adaptador con puerta de enlace)
#   bash scripts/lan-cert.sh 192.168.1.50
#
# Crea en .certs/ (ignorado por git):
#   ca.key / ca.crt          CA local "GeoScript Dev CA". Se crea una sola vez y se reutiliza:
#                            el iPhone la instala una vez aunque cambie la IP.
#   server.key / server.crt  Certificado del servidor firmado por la CA (localhost + la IP).
# ca.key es privada: nunca la compartas ni la subas al repositorio.
set -euo pipefail

cd "$(dirname "$0")/.."
DIR=.certs
mkdir -p "$DIR"

# Git Bash convierte argumentos que empiezan con "/" en rutas de Windows (rompe -subj)
export MSYS2_ARG_CONV_EXCL='*'

IP="${1:-}"
if [ -z "$IP" ] && command -v powershell.exe >/dev/null 2>&1; then
  IP=$(powershell.exe -NoProfile -Command "(Get-NetIPConfiguration | Where-Object { \$_.IPv4DefaultGateway -and \$_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1).IPv4Address.IPAddress" | tr -d '\r')
fi
if ! [[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "✖ No se pudo detectar la IP local. Pásala como argumento: bash scripts/lan-cert.sh 192.168.1.50" >&2
  exit 1
fi

if [ ! -f "$DIR/ca.key" ] || [ ! -f "$DIR/ca.crt" ]; then
  echo "• Creando CA local (válida 825 días)"
  openssl req -x509 -new -newkey rsa:2048 -nodes -sha256 -days 825 \
    -keyout "$DIR/ca.key" -out "$DIR/ca.crt" \
    -subj "/CN=GeoScript Dev CA/O=GeoScript (solo desarrollo)" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,keyCertSign,cRLSign"
else
  echo "• Reutilizando la CA existente"
fi

# iOS exige: SAN, extendedKeyUsage serverAuth y vigencia <= 825 días
cat > "$DIR/server.ext" <<EOF
basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$IP
EOF

echo "• Firmando certificado del servidor para localhost y $IP"
openssl req -new -newkey rsa:2048 -nodes -sha256 \
  -keyout "$DIR/server.key" -out "$DIR/server.csr" \
  -subj "/CN=$IP/O=GeoScript (solo desarrollo)"
openssl x509 -req -sha256 -days 397 \
  -in "$DIR/server.csr" -CA "$DIR/ca.crt" -CAkey "$DIR/ca.key" -CAcreateserial \
  -out "$DIR/server.crt" -extfile "$DIR/server.ext"
rm -f "$DIR/server.csr" "$DIR/server.ext"
echo "$IP" > "$DIR/ip.txt"

echo "✔ Listo. Abre en el iPhone: https://$IP:5173  (CA para instalar: https://$IP:5173/dev-ca.crt)"
