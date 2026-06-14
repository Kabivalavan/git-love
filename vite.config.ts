import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split admin and storefront into isolated chunk graphs.
        // Customers visiting the storefront never download admin code, and vice versa.
        manualChunks(id: string) {
          if (!id.includes("node_modules") && !id.includes("/src/")) return undefined;

          // Vendors
          if (id.includes("node_modules")) {
            if (id.includes("react-router") || id.includes("@tanstack/react-query")) {
              return "vendor-react";
            }
            if (id.includes("recharts") || id.includes("d3-")) {
              return "vendor-charts";
            }
            if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("cmdk") || id.includes("sonner")) {
              return "vendor-ui";
            }
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }
            return undefined;
          }

          // Admin surface
          if (
            id.includes("/src/pages/admin/") ||
            id.includes("/src/components/admin/") ||
            id.includes("/src/api/admin") ||
            id.includes("/src/api/reports2") ||
            id.includes("/src/hooks/useAdmin") ||
            id.includes("/src/hooks/useReports2Query") ||
            id.includes("/src/hooks/useActivityLog")
          ) {
            return "admin";
          }

          // Storefront surface
          if (
            id.includes("/src/pages/store/") ||
            id.includes("/src/components/storefront/") ||
            id.includes("/src/components/home/") ||
            id.includes("/src/components/product/") ||
            id.includes("/src/hooks/useCartQuery") ||
            id.includes("/src/hooks/useGlobalStore") ||
            id.includes("/src/hooks/useConversionOptimization") ||
            id.includes("/src/hooks/useOffers") ||
            id.includes("/src/hooks/useProductQuery")
          ) {
            return "storefront";
          }

          return undefined;
        },
      },
    },
  },
}));
