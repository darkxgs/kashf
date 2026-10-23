import Link from "next/link";
import { PRODUCTS } from "./data";

export default function DemoStoreHome() {
  return (
    <main>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pt-4 lg:grid-cols-2">
        <div>
          <h1 className="text-[44px] leading-tight font-semibold">عطور تبقى في الذاكرة</h1>
          <p className="mt-4 max-w-md text-[17px] leading-relaxed text-[#6b5a48]">دهن عود، عنبر، وبخور مختار من أجود المصادر. توصيل لكل مدن المملكة خلال يومين إلى أربعة أيام.</p>
          <Link href="/demo-store/products/oud-roller" className="mt-7 inline-block rounded-full bg-[#2b2118] px-7 py-3 text-[15px] text-[#f3e9dc]">
            تسوّق دهن العود
          </Link>
        </div>
        {/* A 2000-pixel PNG shown at 600 pixels: the heaviest file on the page, on purpose. */}
        <img src="/demo-store/img/hero.png" alt="زجاجات عطر على حجر" className="w-full rounded-3xl" />
      </section>
      <section className="mx-auto mt-20 max-w-6xl px-5">
        <h1 className="text-[28px] font-semibold">الأكثر مبيعًا</h1>
        <div className="mt-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {PRODUCTS.map((p) => (
            <Link key={p.slug} href={`/demo-store/products/${p.slug}`} className="group">
              <img src={p.img} alt={p.alt} className="aspect-square w-full rounded-2xl object-cover" />
              <p className="mt-3 text-[16px] font-medium">{p.name}</p>
              <p className="text-[14px] text-[#6b5a48]">{p.price} ر.س</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="mx-auto mt-20 grid max-w-6xl gap-6 px-5 sm:grid-cols-3">
        {[
          ["توصيل سريع", "خلال يومين إلى أربعة أيام لكل مدن المملكة."],
          ["أصالة مضمونة", "عود طبيعي من مصادر موثوقة."],
          ["تغليف هدايا", "مجاني مع كل طلب فوق 300 ريال."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-2xl bg-white p-6">
            <p className="text-[17px] font-semibold">{t}</p>
            <p className="mt-1 text-[14px] text-[#6b5a48]">{d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
