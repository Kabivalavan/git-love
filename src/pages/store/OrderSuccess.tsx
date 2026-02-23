import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Package, ArrowRight } from 'lucide-react';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';

const SuccessTick = () => (
  <svg
    viewBox="0 0 120 120"
    className="h-28 w-28 mx-auto"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Outer circle */}
    <motion.circle
      cx="60"
      cy="60"
      r="54"
      fill="none"
      stroke="hsl(142, 71%, 45%)"
      strokeWidth="5"
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
    />
    {/* Filled circle background */}
    <motion.circle
      cx="60"
      cy="60"
      r="54"
      fill="hsl(142, 71%, 45%)"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 0.12 }}
      transition={{ duration: 0.3, delay: 0.5 }}
    />
    {/* Checkmark */}
    <motion.path
      d="M38 62 L52 76 L82 46"
      fill="none"
      stroke="hsl(142, 71%, 45%)"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.4, delay: 0.6, ease: 'easeOut' }}
    />
  </svg>
);

// Generate a short success chime using Web Audio API
function playSuccessSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.5);
    });
  } catch {
    // Silently fail if audio not supported
  }
}

export default function OrderSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('order');
  const soundPlayed = useRef(false);

  useEffect(() => {
    if (!soundPlayed.current) {
      soundPlayed.current = true;
      const timer = setTimeout(playSuccessSound, 600);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-lg mx-auto text-center">
          <CardContent className="py-12">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="mb-4"
            >
              <SuccessTick />
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.4 }}
            >
              <h1 className="text-2xl font-bold mb-2">Order Placed Successfully!</h1>
              <p className="text-muted-foreground mb-4">
                Thank you for your order. We'll send you a confirmation email shortly.
              </p>
            </motion.div>

            {orderNumber && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1, duration: 0.4 }}
                className="bg-muted rounded-lg p-4 mb-6"
              >
                <p className="text-sm text-muted-foreground">Order Number</p>
                <p className="text-xl font-bold">{orderNumber}</p>
              </motion.div>
            )}

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.4 }}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <Button asChild>
                <Link to="/account/orders">
                  <Package className="h-4 w-4 mr-2" />
                  Track Order
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/products">
                  Continue Shopping
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </div>
    </StorefrontLayout>
  );
}
