import { useState } from 'react';
import AdminOffers from './Offers';
import AdminCoupons from './Coupons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function AdminOffersAndCoupons() {
  const [activeTab, setActiveTab] = useState<'offers' | 'coupons'>('offers');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant={activeTab === 'offers' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('offers')}
          className={cn('h-9')}
        >
          Offers
        </Button>
        <Button
          variant={activeTab === 'coupons' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('coupons')}
          className={cn('h-9')}
        >
          Coupons
        </Button>
      </div>

      {activeTab === 'offers' ? <AdminOffers /> : <AdminCoupons />}
    </div>
  );
}
