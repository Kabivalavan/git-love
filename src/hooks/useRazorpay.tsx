import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  handler: (response: RazorpayResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      open: () => void;
      close: () => void;
    };
  }
}

export function useRazorpay() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const loadRazorpayScript = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  const createOrder = useCallback(async (amount: number, receipt?: string) => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please login to continue');
      }

      const response = await fetch(
        `https://riqjidlyjyhfpgnjtbqi.supabase.co/functions/v1/razorpay-create-order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ amount, receipt }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create order');
      }

      return await response.json();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to initialize payment',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const verifyPayment = useCallback(async (
    razorpay_order_id: string,
    razorpay_payment_id: string,
    razorpay_signature: string,
    order_id: string
  ) => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please login to continue');
      }

      const response = await fetch(
        `https://riqjidlyjyhfpgnjtbqi.supabase.co/functions/v1/razorpay-verify-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            order_id,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Payment verification failed');
      }

      return await response.json();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Payment verification failed',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const initiatePayment = useCallback(async (options: {
    amount: number;
    orderId: string;
    orderNumber: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    onSuccess: () => void;
    onFailure: (error: string) => void;
  }) => {
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        options.onFailure('Failed to load payment gateway');
        return;
      }

      const razorpayOrder = await createOrder(options.amount, options.orderNumber);

      const razorpayOptions: RazorpayOptions = {
        key: razorpayOrder.key_id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        name: 'Decon Fashions',
        description: `Payment for Order #${options.orderNumber}`,
        order_id: razorpayOrder.order_id,
        prefill: {
          name: options.customerName,
          email: options.customerEmail,
          contact: options.customerPhone,
        },
        theme: {
          color: '#0066FF',
        },
        handler: async (response) => {
          try {
            await verifyPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature,
              options.orderId
            );
            options.onSuccess();
          } catch (error: any) {
            options.onFailure(error.message || 'Payment verification failed');
          }
        },
        modal: {
          ondismiss: () => {
            options.onFailure('Payment cancelled');
          },
        },
      };

      const razorpay = new window.Razorpay(razorpayOptions);
      razorpay.open();
    } catch (error: any) {
      options.onFailure(error.message || 'Failed to initiate payment');
    }
  }, [loadRazorpayScript, createOrder, verifyPayment]);

  return {
    isLoading,
    createOrder,
    verifyPayment,
    initiatePayment,
  };
}
