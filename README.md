# 🚀 SiteBlueprint Landing & Pricing Page

SiteBlueprint is an all-in-one website planning tool that turns a rough client discovery session into a professional, deliverable-ready proposal—complete with hierarchical sitemaps, customized page outlines, tailor-made content questionnaires, and client-branded PDF/vector sitemap exports—in minutes, not hours.

This sub-project implements the high-fidelity, interactive **Landing & Pricing Page** using the official **First Creation Media** brand design.

---

## 🛠️ Tech Stack & Architecture

- **Core**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4.0 (leveraging the new CSS-based theme system)
- **Icons**: Lucide React
- **Typography & Brand Style**: 
  - **Headings & Titles**: *Juniper Light* (self-hosted OTF web font, loaded via `@font-face`)
  - **Body Copy**: *Poppins* (Regular, Medium, Semibold, and Bold TTF self-hosted font family)
  - **Color Block Theme**: Chocolates and Deep Wine/Burgundy (reflecting high-status, creative, and "quiet luxury" astaticism)

---

## 🏃‍♂️ How to Run This Project Locally

Follow these quick steps to get the development server up and running on your local machine:

### 1. Prerequisite: Verify Node.js
Ensure you have Node.js installed (v18+ recommended):
```bash
node -v
```

### 2. Install Project Dependencies
Run `npm install` inside the project workspace directory (`/home/agent-engineer/agents` or your cloned repository root):
```bash
npm install
```

### 3. Start the Development Server
Launch the local development server (this project is pre-configured to bind publicly to port `3000` on all interfaces):
```bash
npm run dev
```

The app will start and will be live at:
- **Local url**: `http://localhost:3000`
- **Network url**: `http://<your-ip>:3000`

---

## 📦 Building for Production

To bundle and optimize the project for a production release, run the following command:

```bash
npm run build
```

This compiles all TypeScript assets, bundles Tailwind styling, and outputs a highly optimized static bundle into the `dist/` directory, ready to be served from any single-origin hosting provider.

To test the compiled bundle locally:
```bash
npm run preview -- --port 3000 --host
```

---

## ✨ Key Interactive Features on the Landing Page

To help prospective "Planners" and "Explorers" experience the platform immediately, the landing page includes a fully functional **Interactive Website Planning Simulator**:

1. **Interactive Templates**: Toggle between *E-Commerce*, *Local Business*, and *SaaS Platform* to instantly load corresponding hierarchical sitemaps.
2. **Interactive Sitemap & Page Detail Inspection**: Click through sitemap page cards to view real-time changes in the Page Outline Editor.
3. **Tailored Content Questionnaires**: Witness how question banks automatically morph based on the active page type (e.g. homepage vs contact vs pricing).
4. **Premium Branding Customizer**: Interactively customize the agency logo name, primary color hex, secondary color hex, and **select from the 4 brand-new designer-made transparent logo assets** (*Blue, Navy, White, Black*).
5. **Real-time Proposal Preview**: Instantly watch the choose-your-own-brand customizer reflect its logo asset and colors in the "Proposal Cover Preview".
6. **Vector PDF Export Simulation**: Trigger a mock export to see the vector proposal compiler compile the package in real-time.
