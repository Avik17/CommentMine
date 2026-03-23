# CommentMine — Setup Instructions

## Files
- `index.html` — Landing page (already deployed)
- `app.html` — The actual tool (payment gate + analysis + output)
- `api/analyse.js` — Serverless function calling Claude API
- `vercel.json` — Vercel configuration

## Setup Steps

### 1. Add your keys to app.html
Open `app.html` and find this line:
```
const RAZORPAY_KEY = 'YOUR_RAZORPAY_KEY_ID';
```
Replace with your actual Razorpay Key ID (rzp_live_...)

### 2. Add Claude API key to Vercel
- Go to your Vercel project dashboard
- Settings → Environment Variables
- Add: CLAUDE_API_KEY = your sk-ant-... key
- Redeploy after adding

### 3. Deploy to Vercel
- Push all files to your GitHub repo (commentmine)
- Vercel auto-deploys on push
- OR drag folder to Vercel dashboard

### 4. Update landing page CTA
In `index.html`, update the "Try for ₹99" button links:
```
href="app.html"
```

## Folder Structure
```
commentmine/
├── index.html
├── app.html
├── vercel.json
├── README.md
└── api/
    └── analyse.js
```

## Testing
1. Open app.html locally in browser
2. It will show payment screen
3. After payment, paste sample comments
4. Check output renders correctly

## Go Live Checklist
- [ ] Razorpay Key ID added to app.html
- [ ] CLAUDE_API_KEY added to Vercel environment variables
- [ ] index.html CTA buttons updated to point to app.html
- [ ] Test payment flow with a real ₹1 transaction first
- [ ] Switch Razorpay to live mode
