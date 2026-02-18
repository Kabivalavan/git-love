export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          created_at: string | null
          full_name: string
          id: string
          is_default: boolean | null
          label: string | null
          landmark: string | null
          mobile_number: string
          pincode: string
          state: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          created_at?: string | null
          full_name: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          landmark?: string | null
          mobile_number: string
          pincode: string
          state: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          created_at?: string | null
          full_name?: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          landmark?: string | null
          mobile_number?: string
          pincode?: string
          state?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          category_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          page_path: string | null
          product_id: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          product_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          product_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          media_url: string
          position: Database["public"]["Enums"]["banner_position"]
          redirect_url: string | null
          show_on_desktop: boolean | null
          show_on_mobile: boolean | null
          sort_order: number | null
          start_date: string | null
          title: string
          type: Database["public"]["Enums"]["banner_type"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          media_url: string
          position: Database["public"]["Enums"]["banner_position"]
          redirect_url?: string | null
          show_on_desktop?: boolean | null
          show_on_mobile?: boolean | null
          sort_order?: number | null
          start_date?: string | null
          title: string
          type?: Database["public"]["Enums"]["banner_type"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          media_url?: string
          position?: Database["public"]["Enums"]["banner_position"]
          redirect_url?: string | null
          show_on_desktop?: boolean | null
          show_on_mobile?: boolean | null
          sort_order?: number | null
          start_date?: string | null
          title?: string
          type?: Database["public"]["Enums"]["banner_type"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bundle_items: {
        Row: {
          bundle_id: string
          created_at: string | null
          id: string
          product_id: string
          quantity: number
          sort_order: number | null
        }
        Insert: {
          bundle_id: string
          created_at?: string | null
          id?: string
          product_id: string
          quantity?: number
          sort_order?: number | null
        }
        Update: {
          bundle_id?: string
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bundles: {
        Row: {
          bundle_price: number
          compare_price: number | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          bundle_price: number
          compare_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          bundle_price?: number
          compare_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cart: {
        Row: {
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string | null
          id: string
          product_id: string
          quantity: number
          updated_at: string | null
          variant_id: string | null
        }
        Insert: {
          cart_id: string
          created_at?: string | null
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string | null
          variant_id?: string | null
        }
        Update: {
          cart_id?: string
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "cart"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usage: {
        Row: {
          coupon_id: string
          id: string
          order_id: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          order_id?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          order_id?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          max_discount: number | null
          min_order_value: number | null
          per_user_limit: number | null
          start_date: string | null
          type: Database["public"]["Enums"]["offer_type"]
          updated_at: string | null
          usage_limit: number | null
          used_count: number | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_discount?: number | null
          min_order_value?: number | null
          per_user_limit?: number | null
          start_date?: string | null
          type: Database["public"]["Enums"]["offer_type"]
          updated_at?: string | null
          usage_limit?: number | null
          used_count?: number | null
          value: number
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_discount?: number | null
          min_order_value?: number | null
          per_user_limit?: number | null
          start_date?: string | null
          type?: Database["public"]["Enums"]["offer_type"]
          updated_at?: string | null
          usage_limit?: number | null
          used_count?: number | null
          value?: number
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          cod_amount: number | null
          cod_collected: boolean | null
          created_at: string | null
          delivered_at: string | null
          delivery_charge: number | null
          estimated_date: string | null
          id: string
          is_cod: boolean | null
          notes: string | null
          order_id: string
          partner_name: string | null
          status: Database["public"]["Enums"]["delivery_status"] | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string | null
        }
        Insert: {
          cod_amount?: number | null
          cod_collected?: boolean | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_charge?: number | null
          estimated_date?: string | null
          id?: string
          is_cod?: boolean | null
          notes?: string | null
          order_id: string
          partner_name?: string | null
          status?: Database["public"]["Enums"]["delivery_status"] | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
        }
        Update: {
          cod_amount?: number | null
          cod_collected?: boolean | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_charge?: number | null
          estimated_date?: string | null
          id?: string
          is_cod?: boolean | null
          notes?: string | null
          order_id?: string
          partner_name?: string | null
          status?: Database["public"]["Enums"]["delivery_status"] | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string | null
          created_by: string | null
          date: string
          description: string
          id: string
          notes: string | null
          receipt_url: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string | null
          created_by?: string | null
          date: string
          description: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      offers: {
        Row: {
          auto_apply: boolean | null
          buy_quantity: number | null
          category_id: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          get_quantity: number | null
          id: string
          is_active: boolean | null
          max_discount: number | null
          min_order_value: number | null
          name: string
          product_id: string | null
          show_timer: boolean | null
          start_date: string | null
          type: Database["public"]["Enums"]["offer_type"]
          updated_at: string | null
          value: number
        }
        Insert: {
          auto_apply?: boolean | null
          buy_quantity?: number | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          get_quantity?: number | null
          id?: string
          is_active?: boolean | null
          max_discount?: number | null
          min_order_value?: number | null
          name: string
          product_id?: string | null
          show_timer?: boolean | null
          start_date?: string | null
          type: Database["public"]["Enums"]["offer_type"]
          updated_at?: string | null
          value: number
        }
        Update: {
          auto_apply?: boolean | null
          buy_quantity?: number | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          get_quantity?: number | null
          id?: string
          is_active?: boolean | null
          max_discount?: number | null
          min_order_value?: number | null
          name?: string
          product_id?: string | null
          show_timer?: boolean | null
          start_date?: string | null
          type?: Database["public"]["Enums"]["offer_type"]
          updated_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "offers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          price: number
          product_id: string | null
          product_name: string
          quantity: number
          sku: string | null
          total: number
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          price: number
          product_id?: string | null
          product_name: string
          quantity: number
          sku?: string | null
          total: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          price?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          sku?: string | null
          total?: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json | null
          coupon_code: string | null
          coupon_id: string | null
          created_at: string | null
          discount: number | null
          id: string
          notes: string | null
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          shipping_address: Json
          shipping_charge: number | null
          status: Database["public"]["Enums"]["order_status"] | null
          subtotal: number
          tax: number | null
          total: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          billing_address?: Json | null
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          shipping_address: Json
          shipping_charge?: number | null
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal: number
          tax?: number | null
          total: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          billing_address?: Json | null
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          shipping_address?: Json
          shipping_charge?: number | null
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal?: number
          tax?: number | null
          total?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          gateway_response: Json | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          refund_amount: number | null
          refund_reason: string | null
          status: Database["public"]["Enums"]["payment_status"] | null
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          gateway_response?: Json | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          refund_amount?: number | null
          refund_reason?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          gateway_response?: Json | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string
          refund_amount?: number | null
          refund_reason?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string | null
          id: string
          image_url: string
          is_primary: boolean | null
          product_id: string
          sort_order: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          image_url: string
          is_primary?: boolean | null
          product_id: string
          sort_order?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          image_url?: string
          is_primary?: boolean | null
          product_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          mrp: number | null
          name: string
          price: number | null
          product_id: string
          sku: string | null
          stock_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          attributes?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          mrp?: number | null
          name: string
          price?: number | null
          product_id: string
          sku?: string | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          attributes?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          mrp?: number | null
          name?: string
          price?: number | null
          product_id?: string
          sku?: string | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          badge: string | null
          barcode: string | null
          category_id: string | null
          content_sections: Json | null
          cost_price: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_bestseller: boolean | null
          is_featured: boolean | null
          low_stock_threshold: number | null
          mrp: number | null
          name: string
          price: number
          shipping_weight: number | null
          short_description: string | null
          sku: string | null
          slug: string
          sort_order: number | null
          stock_quantity: number | null
          tax_rate: number | null
          updated_at: string | null
          variant_required: boolean | null
        }
        Insert: {
          badge?: string | null
          barcode?: string | null
          category_id?: string | null
          content_sections?: Json | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_bestseller?: boolean | null
          is_featured?: boolean | null
          low_stock_threshold?: number | null
          mrp?: number | null
          name: string
          price: number
          shipping_weight?: number | null
          short_description?: string | null
          sku?: string | null
          slug: string
          sort_order?: number | null
          stock_quantity?: number | null
          tax_rate?: number | null
          updated_at?: string | null
          variant_required?: boolean | null
        }
        Update: {
          badge?: string | null
          barcode?: string | null
          category_id?: string | null
          content_sections?: Json | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_bestseller?: boolean | null
          is_featured?: boolean | null
          low_stock_threshold?: number | null
          mrp?: number | null
          name?: string
          price?: number
          shipping_weight?: number | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          sort_order?: number | null
          stock_quantity?: number | null
          tax_rate?: number | null
          updated_at?: string | null
          variant_required?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_blocked: boolean | null
          mobile_number: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean | null
          mobile_number?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean | null
          mobile_number?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          is_approved: boolean | null
          is_verified: boolean | null
          product_id: string
          rating: number
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          is_verified?: boolean | null
          product_id: string
          rating: number
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          is_verified?: boolean | null
          product_id?: string
          rating?: number
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      storefront_config: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          page_name: string
          sections: Json | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          page_name: string
          sections?: Json | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          page_name?: string
          sections?: Json | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlist: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "customer"
      banner_position:
        | "home_top"
        | "home_middle"
        | "category"
        | "offer"
        | "popup"
      banner_type: "image" | "video"
      delivery_status:
        | "pending"
        | "assigned"
        | "picked"
        | "in_transit"
        | "delivered"
        | "failed"
      expense_category:
        | "ads"
        | "packaging"
        | "delivery"
        | "staff"
        | "rent"
        | "utilities"
        | "software"
        | "other"
      offer_type: "percentage" | "flat" | "buy_x_get_y"
      order_status:
        | "new"
        | "confirmed"
        | "packed"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "returned"
      payment_method: "online" | "cod" | "wallet"
      payment_status: "pending" | "paid" | "failed" | "refunded" | "partial"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff", "customer"],
      banner_position: [
        "home_top",
        "home_middle",
        "category",
        "offer",
        "popup",
      ],
      banner_type: ["image", "video"],
      delivery_status: [
        "pending",
        "assigned",
        "picked",
        "in_transit",
        "delivered",
        "failed",
      ],
      expense_category: [
        "ads",
        "packaging",
        "delivery",
        "staff",
        "rent",
        "utilities",
        "software",
        "other",
      ],
      offer_type: ["percentage", "flat", "buy_x_get_y"],
      order_status: [
        "new",
        "confirmed",
        "packed",
        "shipped",
        "delivered",
        "cancelled",
        "returned",
      ],
      payment_method: ["online", "cod", "wallet"],
      payment_status: ["pending", "paid", "failed", "refunded", "partial"],
    },
  },
} as const
