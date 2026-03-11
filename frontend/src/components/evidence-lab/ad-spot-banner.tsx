export function AdSpotBanner() {
  return (
    <div className="overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
      <img
        src="/ms_ad_placeholder.png"
        alt="瓜田布告栏广告位占位图"
        className="h-36 w-full object-cover"
        loading="lazy"
      />
      <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
        黄金广告位长期开放（可定制图文）- 商务合作请联系作者
      </div>
    </div>
  );
}
