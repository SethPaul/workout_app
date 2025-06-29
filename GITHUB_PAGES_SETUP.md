# GitHub Pages Deployment Setup

A GitHub Actions workflow has been created to automatically deploy your Flutter web app to GitHub Pages when you push to the `main` branch.

## Repository Configuration Required

To enable GitHub Pages deployment, you need to configure your repository settings:

### 1. Enable GitHub Pages
1. Go to your repository on GitHub
2. Click on **Settings** tab
3. Scroll down to **Pages** section in the left sidebar
4. Under **Source**, select **GitHub Actions**

### 2. Workflow Details

The deployment workflow (`deploy.yml`) will:
- ✅ Trigger on pushes to the `main` branch
- ✅ Build your Flutter web app using the same Flutter version (3.16.0) as your existing workflows
- ✅ Deploy the built files to GitHub Pages
- ✅ Handle missing asset directories automatically
- ✅ Use the HTML web renderer for better compatibility

### 3. Accessing Your Deployed App

Once the workflow runs successfully, your workout app will be available at:
```
https://[your-username].github.io/[repository-name]
```

### 4. Triggering Deployment

The deployment will happen automatically when you:
- Push commits to the `main` branch
- Manually trigger the workflow from the Actions tab

### 5. Monitoring Deployment

You can monitor the deployment process in the **Actions** tab of your repository. The workflow includes two jobs:
1. **Build** - Compiles your Flutter web app
2. **Deploy** - Publishes to GitHub Pages

## Troubleshooting

If the deployment fails:
1. Check the Actions tab for detailed error logs
2. Ensure all tests pass (the workflow doesn't depend on tests, but it's good practice)
3. Verify that your Flutter web app builds locally with `flutter build web --release`

## Manual Deployment

You can also trigger deployment manually by going to Actions → Deploy to GitHub Pages → Run workflow.