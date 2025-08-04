#!/bin/bash

# Railway Deployment Verification Script
echo "🚀 Verifying Railway deployment..."

# Get Railway app URL (replace with your actual URL)
RAILWAY_URL="${RAILWAY_URL:-https://your-app.railway.app}"

echo "📍 Testing Railway app at: $RAILWAY_URL"

# Test health endpoint
echo "🔍 Testing health endpoint..."
curl -f "$RAILWAY_URL/health" || echo "❌ Health check failed"

# Test WhatsApp service info
echo "🔍 Testing WhatsApp service info..."
curl -f "$RAILWAY_URL/api/whatsapp/service-info" || echo "❌ Service info failed"

# Test connection status
echo "🔍 Testing connection status..."
curl -f "$RAILWAY_URL/api/whatsapp/connection" || echo "❌ Connection check failed"

echo "✅ Verification complete!"
echo ""
echo "📊 Monitor your deployment:"
echo "  Health: $RAILWAY_URL/health"
echo "  Service Info: $RAILWAY_URL/api/whatsapp/service-info" 
echo "  Connection: $RAILWAY_URL/api/whatsapp/connection"
echo ""
echo "🔧 If Chrome fails, the service should automatically fallback to Baileys!"
