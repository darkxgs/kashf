// What each check says, in English and Arabic: a title that states the result,
// why it matters to a shop, and how to fix it (with platform notes where the
// steps are specific and stable).
import { arCount, bytes, ms } from "./format";
import type { Finding, Lang, PlatformId, Status } from "./types";

type Txt = { en: string; ar: string };
type Vars = Record<string, string | number>;
type Title = Txt | ((v: Vars, lang: Lang) => Txt);
type CheckCopy = { title: Partial<Record<Status, Title>>; why: Txt; fix: Txt; platform?: Partial<Record<PlatformId, Txt>> };

const t = (en: string, ar: string): Txt => ({ en, ar });
const n = (v: Vars, k: string) => Number(v[k] ?? 0);

const IMAGES = { one: "صورة واحدة", two: "صورتان", few: "صور", many: "صورة" };
const SCRIPTS = { one: "سكربت واحد", two: "سكربتان", few: "سكربتات", many: "سكربتًا" };
const SERVICES = { one: "خدمة خارجية واحدة", two: "خدمتان خارجيتان", few: "خدمات خارجية", many: "خدمة خارجية" };
const LINKS = { one: "رابط معطل", two: "رابطان معطلان", few: "روابط معطلة", many: "رابطًا معطلًا" };
const FILES = { one: "ملف واحد", two: "ملفان", few: "ملفات", many: "ملفًا" };
const HEADINGS = { one: "عنوان رئيسي واحد", two: "عنوانان رئيسيان", few: "عناوين رئيسية", many: "عنوانًا رئيسيًا" };
const DAYS = { one: "يوم واحد", two: "يومين", few: "أيام", many: "يومًا" };
const CHARS = { one: "حرف واحد", two: "حرفان", few: "أحرف", many: "حرفًا" };

export const COPY: Record<string, CheckCopy> = {
  /* ------------------------------- speed ------------------------------- */
  ttfb: {
    title: {
      pass: (v, l) => t(`Your server answers quickly (${ms(n(v, "value"), l)})`, `الخادم يستجيب بسرعة (${ms(n(v, "value"), l)})`),
      warn: (v, l) => t(`Your server takes a while to answer (${ms(n(v, "value"), l)})`, `الخادم يتأخر قليلًا في الاستجابة (${ms(n(v, "value"), l)})`),
      fail: (v, l) => t(`Your server is slow to answer (${ms(n(v, "value"), l)})`, `الخادم بطيء في الاستجابة (${ms(n(v, "value"), l)})`),
    },
    why: t(
      "Nothing appears on screen until the server answers. Every extra second here is a second a shopper stares at a blank page, and many leave.",
      "لا يظهر شيء على الشاشة قبل أن يرد الخادم. كل ثانية إضافية هنا يقضيها العميل أمام صفحة فارغة، وكثيرون يغادرون قبل أن تظهر.",
    ),
    fix: t(
      "Turn on page caching or a CDN, and look for apps or plugins that run on every page view. On hosted platforms this is usually too many apps on the home page.",
      "فعّل التخزين المؤقت للصفحات أو شبكة توصيل المحتوى (CDN)، وابحث عن التطبيقات أو الإضافات التي تعمل مع كل زيارة. في المنصات الجاهزة يكون السبب غالبًا كثرة التطبيقات في الصفحة الرئيسية.",
    ),
    platform: {
      woocommerce: t("Install a page cache (WP Rocket, LiteSpeed Cache or W3 Total Cache) and check that your host isn't overloaded.", "ثبّت إضافة للتخزين المؤقت مثل WP Rocket أو LiteSpeed Cache، وتأكد أن الاستضافة ليست مزدحمة."),
      wordpress: t("Install a page cache (WP Rocket, LiteSpeed Cache or W3 Total Cache) and check that your host isn't overloaded.", "ثبّت إضافة للتخزين المؤقت مثل WP Rocket أو LiteSpeed Cache، وتأكد أن الاستضافة ليست مزدحمة."),
    },
  },
  page_weight: {
    title: {
      pass: (v, l) => t(`The home page is light (${bytes(n(v, "value"), l)})`, `الصفحة الرئيسية خفيفة (${bytes(n(v, "value"), l)})`),
      warn: (v, l) => t(`The home page is getting heavy (${bytes(n(v, "value"), l)})`, `الصفحة الرئيسية أصبحت ثقيلة (${bytes(n(v, "value"), l)})`),
      fail: (v, l) => t(`The home page is heavy (${bytes(n(v, "value"), l)})`, `الصفحة الرئيسية ثقيلة جدًا (${bytes(n(v, "value"), l)})`),
    },
    why: t(
      "Everything the page uses has to download over a phone connection. A heavy page eats into data plans and takes seconds longer to show products.",
      "كل ما تستخدمه الصفحة يجب تنزيله عبر اتصال الجوال. الصفحة الثقيلة تستهلك باقة العميل وتتأخر ثواني في عرض المنتجات.",
    ),
    fix: t(
      "Start with the biggest files listed: resize photos to the size they're shown at and save them as WebP, and remove apps and scripts you no longer use.",
      "ابدأ بأكبر الملفات في القائمة: صغّر الصور إلى الحجم الذي تُعرض به واحفظها بصيغة WebP، واحذف التطبيقات والسكربتات التي لم تعد تستخدمها.",
    ),
  },
  heavy_images: {
    title: {
      pass: t("No oversized images", "لا توجد صور بأحجام مبالغ فيها"),
      warn: (v) => t(`${n(v, "n")} image${n(v, "n") === 1 ? " is" : "s are"} larger than 300 KB`, `${arCount(n(v, "n"), IMAGES)} أكبر من 300 كيلوبايت`),
      fail: (v, l) =>
        t(
          `${n(v, "n")} image${n(v, "n") === 1 ? " is" : "s are"} larger than 300 KB; the biggest is ${bytes(n(v, "max"), l)}`,
          `${arCount(n(v, "n"), IMAGES)} أكبر من 300 كيلوبايت، وأكبرها ${bytes(n(v, "max"), l)}`,
        ),
    },
    why: t(
      "Large photos are the most common reason store pages load slowly. A product photo rarely needs more than 200 KB.",
      "الصور الكبيرة هي السبب الأكثر شيوعًا لبطء صفحات المتاجر. نادرًا ما تحتاج صورة المنتج إلى أكثر من 200 كيلوبايت.",
    ),
    fix: t(
      "Resize photos to at most 2000 pixels wide and export them as WebP or a compressed JPEG. Free tools like Squoosh do this in the browser.",
      "صغّر عرض الصور إلى 2000 بكسل كحد أقصى واحفظها بصيغة WebP أو JPEG مضغوطة. أدوات مجانية مثل Squoosh تفعل ذلك داخل المتصفح.",
    ),
  },
  image_formats: {
    title: {
      pass: (v) => t(`Most images use modern formats (${v.pct}% WebP or AVIF)`, `أغلب الصور بصيغ حديثة (${v.pct}% بصيغة WebP أو AVIF)`),
      warn: (v) => t(`Only ${v.pct}% of images use modern formats`, `${v.pct}% فقط من الصور بصيغ حديثة`),
      fail: (v) => t(`Only ${v.pct}% of images use modern formats`, `${v.pct}% فقط من الصور بصيغ حديثة`),
    },
    why: t("WebP and AVIF photos are usually 25 to 50 percent smaller than JPEG or PNG at the same quality.", "صور WebP وAVIF أصغر عادةً بنسبة 25 إلى 50 بالمئة من JPEG وPNG بنفس الجودة."),
    fix: t("Convert JPEG and PNG product photos to WebP. Most platforms and image plugins can do this automatically.", "حوّل صور المنتجات من JPEG وPNG إلى WebP. معظم المنصات وإضافات الصور تفعل ذلك تلقائيًا."),
    platform: {
      woocommerce: t("A plugin such as Converter for Media can serve WebP versions of your existing images automatically.", "إضافة مثل Converter for Media تعرض نسخ WebP من صورك الحالية تلقائيًا."),
      wordpress: t("A plugin such as Converter for Media can serve WebP versions of your existing images automatically.", "إضافة مثل Converter for Media تعرض نسخ WebP من صورك الحالية تلقائيًا."),
    },
  },
  render_blocking: {
    title: {
      pass: t("Few scripts hold up the first view", "عدد قليل من السكربتات يؤخر ظهور الصفحة"),
      warn: (v) => t(`${v.n} scripts hold up the page before it shows`, `${arCount(n(v, "n"), SCRIPTS)} تؤخر ظهور الصفحة`),
      fail: (v) => t(`${v.n} scripts hold up the page before it shows`, `${arCount(n(v, "n"), SCRIPTS)} تؤخر ظهور الصفحة`),
    },
    why: t(
      "Scripts in the page head without async or defer must download and run before the browser draws anything.",
      "السكربتات الموجودة في رأس الصفحة بدون async أو defer يجب تنزيلها وتشغيلها قبل أن يرسم المتصفح أي شيء.",
    ),
    fix: t(
      "Add defer to scripts that don't need to run first, and remove the ones you no longer use, such as old chat widgets or apps you uninstalled.",
      "أضف defer للسكربتات التي لا يلزم تشغيلها أولًا، واحذف ما لم تعد تستخدمه مثل أدوات الدردشة القديمة أو تطبيقات أزلتها.",
    ),
  },
  compression: {
    title: {
      pass: (v) => t(`Pages are sent compressed (${v.enc})`, `الصفحات تُرسل مضغوطة (${v.enc})`),
      fail: t("Pages are sent uncompressed", "الصفحات تُرسل بدون ضغط"),
    },
    why: t("Compression (gzip or Brotli) shrinks HTML, CSS and JavaScript by around 70 percent on the way to the shopper.", "الضغط (gzip أو Brotli) يقلل حجم HTML وCSS وJavaScript بنحو 70 بالمئة في طريقها إلى العميل."),
    fix: t("Enable gzip or Brotli on your server or CDN. On Cloudflare and most hosts it's a single setting.", "فعّل gzip أو Brotli على الخادم أو شبكة CDN. في Cloudflare ومعظم الاستضافات هو خيار واحد."),
  },
  html_size: {
    title: {
      pass: (v, l) => t(`The page's HTML is lean (${bytes(n(v, "value"), l)})`, `كود الصفحة خفيف (${bytes(n(v, "value"), l)})`),
      warn: (v, l) => t(`The page's HTML is large (${bytes(n(v, "value"), l)})`, `كود الصفحة كبير (${bytes(n(v, "value"), l)})`),
      fail: (v, l) => t(`The page's HTML is very large (${bytes(n(v, "value"), l)})`, `كود الصفحة كبير جدًا (${bytes(n(v, "value"), l)})`),
    },
    why: t("The HTML arrives before anything else. Very large HTML usually means inline data or long product grids that could load later.", "كود HTML يصل قبل أي شيء آخر. الحجم الكبير يعني غالبًا بيانات مضمّنة أو قوائم منتجات طويلة يمكن تحميلها لاحقًا."),
    fix: t("Show fewer products on the home page and move inline scripts and styles into separate files.", "اعرض عددًا أقل من المنتجات في الصفحة الرئيسية وانقل السكربتات والتنسيقات المضمّنة إلى ملفات منفصلة."),
  },
  lazy_images: {
    title: {
      pass: t("Images further down load only when needed", "الصور في أسفل الصفحة لا تُحمّل إلا عند الحاجة"),
      warn: (v) => t(`All ${v.n} images load at once`, `كل الصور (${v.n}) تُحمّل دفعة واحدة`),
    },
    why: t("Images below the first screen can wait until the shopper scrolls. Loading them all up front slows down what's visible.", "الصور أسفل الشاشة الأولى يمكنها الانتظار حتى يمرر العميل. تحميلها كلها مقدمًا يبطئ ما يظهر أمامه."),
    fix: t('Add loading="lazy" to images that aren\'t in the first screen. Most modern themes support it.', 'أضف loading="lazy" للصور التي لا تظهر في الشاشة الأولى. أغلب القوالب الحديثة تدعم ذلك.'),
  },
  image_dimensions: {
    title: {
      pass: t("Images keep their space while loading", "الصور تحجز مكانها أثناء التحميل"),
      warn: (v) => t(`${v.pct}% of images don't keep their space while loading`, `${v.pct}% من الصور لا تحجز مكانها أثناء التحميل`),
      fail: (v) =>
        n(v, "pct") >= 100
          ? t("No image keeps its space while loading", "لا توجد صورة تحجز مكانها أثناء التحميل")
          : t(`${v.pct}% of images don't keep their space while loading`, `${v.pct}% من الصور لا تحجز مكانها أثناء التحميل`),
    },
    why: t("Without a width and height, the page jumps as each image arrives, and shoppers tap the wrong thing.", "بدون عرض وارتفاع محددين، تقفز الصفحة مع وصول كل صورة فيضغط العميل على شيء غير الذي قصده."),
    fix: t("Give each image width and height attributes, or a fixed aspect ratio in CSS.", "حدد عرضًا وارتفاعًا لكل صورة، أو نسبة أبعاد ثابتة عبر CSS."),
  },
  third_parties: {
    title: {
      pass: (v) => t(`Few outside services load code (${v.n})`, `خدمات خارجية قليلة تُحمّل كودًا (${v.n})`),
      warn: (v) => t(`${v.n} outside services load code on your page`, `${arCount(n(v, "n"), SERVICES)} تُحمّل كودًا في صفحتك`),
      fail: (v) => t(`${v.n} outside services load code on your page`, `${arCount(n(v, "n"), SERVICES)} تُحمّل كودًا في صفحتك`),
    },
    why: t(
      "Each outside service (chat, reviews, pixels, pop-ups) adds code the phone has to download and run, and any one of them can slow everything down.",
      "كل خدمة خارجية (دردشة، تقييمات، بكسلات، نوافذ منبثقة) تضيف كودًا على الجوال تنزيله وتشغيله، وأي واحدة منها قد تبطئ الصفحة كلها.",
    ),
    fix: t("Review the list and remove services you don't actively use.", "راجع القائمة واحذف الخدمات التي لا تستخدمها فعليًا."),
  },
  cache_static: {
    title: {
      pass: t("Returning shoppers' browsers keep your files", "متصفحات العملاء العائدين تحتفظ بملفاتك"),
      warn: (v) => t(`Only ${v.pct}% of your files are kept by returning shoppers' browsers`, `${v.pct}% فقط من ملفاتك تحتفظ بها متصفحات العملاء العائدين`),
      fail: (v) =>
        n(v, "pct") === 0
          ? t("Returning shoppers' browsers keep none of your files", "متصفحات العملاء العائدين لا تحتفظ بأي من ملفاتك")
          : t(`Only ${v.pct}% of your files are kept by returning shoppers' browsers`, `${v.pct}% فقط من ملفاتك تحتفظ بها متصفحات العملاء العائدين`),
    },
    why: t("When files are cached, a returning shopper's browser doesn't download them again, so the second visit is much faster.", "عندما تُخزّن الملفات مؤقتًا لا يعيد متصفح العميل العائد تنزيلها، فتصبح زيارته الثانية أسرع بكثير."),
    fix: t("Set long Cache-Control lifetimes (a week or more) for images, CSS and JavaScript on your server or CDN.", "اضبط مدة Cache-Control طويلة (أسبوع أو أكثر) للصور وملفات CSS وJavaScript على الخادم أو CDN."),
  },
  psi: {
    title: {
      pass: (v) => t(`Google's mobile speed score: ${v.value}`, `تقييم Google للسرعة على الجوال: ${v.value}`),
      warn: (v) => t(`Google's mobile speed score: ${v.value}`, `تقييم Google للسرعة على الجوال: ${v.value}`),
      fail: (v) => t(`Google's mobile speed score: ${v.value}`, `تقييم Google للسرعة على الجوال: ${v.value}`),
    },
    why: t("The same Lighthouse test Google runs in PageSpeed Insights, on a simulated mid-range phone.", "نفس اختبار Lighthouse الذي تجريه Google في PageSpeed Insights، على جوال متوسط افتراضي."),
    fix: t("Fix the speed items above first; they usually account for most of this score.", "ابدأ بإصلاح بنود السرعة أعلاه، فهي عادةً سبب معظم هذا التقييم."),
  },

  /* ------------------------------- search ------------------------------ */
  indexable: {
    title: {
      pass: t("Search engines are allowed to list this page", "محركات البحث مسموح لها بإظهار هذه الصفحة"),
      fail: t("This page tells search engines not to list it", "هذه الصفحة تطلب من محركات البحث عدم إظهارها"),
    },
    why: t("A noindex tag or header keeps the page out of Google entirely, however good it is.", "وسم noindex يُخرج الصفحة من نتائج Google تمامًا مهما كانت جيدة."),
    fix: t(
      "Remove the noindex robots tag. It often comes from a store password or a 'hide from search engines' setting left on after launch.",
      "احذف وسم noindex. غالبًا يأتي من كلمة مرور للمتجر أو خيار «إخفاء من محركات البحث» نُسي مفعّلًا بعد الإطلاق.",
    ),
    platform: {
      wordpress: t("In WordPress, untick 'Discourage search engines from indexing this site' under Settings, Reading.", "في ووردبريس، ألغِ تحديد «منع محركات البحث من أرشفة هذا الموقع» من الإعدادات، ثم القراءة."),
      woocommerce: t("In WordPress, untick 'Discourage search engines from indexing this site' under Settings, Reading.", "في ووردبريس، ألغِ تحديد «منع محركات البحث من أرشفة هذا الموقع» من الإعدادات، ثم القراءة."),
      shopify: t("In Shopify, remove the storefront password under Online Store, Preferences.", "في شوبيفاي، احذف كلمة مرور المتجر من Online Store ثم Preferences."),
    },
  },
  content_visible: {
    title: {
      pass: t("Content is there without JavaScript", "المحتوى موجود بدون JavaScript"),
      fail: t("The page is nearly empty without JavaScript", "الصفحة شبه فارغة بدون JavaScript"),
    },
    why: t("This store builds its page in the browser. Search engines and link previews may see an empty page.", "هذا المتجر يبني صفحته داخل المتصفح، فقد ترى محركات البحث ومعاينات الروابط صفحة فارغة."),
    fix: t("Use server-side rendering or pre-rendering, at least for product and category pages.", "استخدم العرض من جهة الخادم أو التوليد المسبق، على الأقل لصفحات المنتجات والأقسام."),
  },
  title: {
    title: {
      pass: (v) => t(`Page title is set (${v.len} characters)`, `عنوان الصفحة موجود (${arCount(n(v, "len"), CHARS)})`),
      warn: (v) =>
        v.short
          ? t(`Page title is very short (${v.len} characters)`, `عنوان الصفحة قصير جدًا (${arCount(n(v, "len"), CHARS)})`)
          : t(`Page title is too long (${v.len} characters)`, `عنوان الصفحة طويل جدًا (${arCount(n(v, "len"), CHARS)})`),
      fail: t("The page has no title", "الصفحة بدون عنوان"),
    },
    why: t(
      "The title is the blue headline in Google results and the name on the browser tab. Aim for 30 to 65 characters with your store name and what you sell.",
      "العنوان هو السطر الأزرق في نتائج Google واسم تبويب المتصفح. اجعله بين 30 و65 حرفًا ويضم اسم متجرك وما تبيعه.",
    ),
    fix: t('Set a title like "Bait Al Oud | Arabic perfumes and oud oils" in your store\'s SEO settings.', "اكتب عنوانًا مثل «بيت العود | عطور عربية ودهن عود» في إعدادات تحسين الظهور (SEO) لمتجرك."),
    platform: {
      shopify: t("In Shopify: Online Store, Preferences, Title and meta description.", "في شوبيفاي: Online Store ثم Preferences ثم Title and meta description."),
      woocommerce: t("Use an SEO plugin such as Yoast SEO or Rank Math to set it.", "استخدم إضافة SEO مثل Yoast SEO أو Rank Math لضبطه."),
      wordpress: t("Use an SEO plugin such as Yoast SEO or Rank Math to set it.", "استخدم إضافة SEO مثل Yoast SEO أو Rank Math لضبطه."),
    },
  },
  meta_description: {
    title: {
      pass: (v) => t(`Search description is set (${v.len} characters)`, `وصف البحث موجود (${arCount(n(v, "len"), CHARS)})`),
      warn: (v) =>
        v.short
          ? t(`Search description is short (${v.len} characters)`, `وصف البحث قصير (${arCount(n(v, "len"), CHARS)})`)
          : t(`Search description is long (${v.len} characters)`, `وصف البحث طويل (${arCount(n(v, "len"), CHARS)})`),
      fail: t("There's no search description", "لا يوجد وصف للبحث"),
    },
    why: t(
      "This is the grey text under your title in Google. Without one, Google picks text from the page, which rarely sells.",
      "هو النص الرمادي تحت عنوانك في Google. بدونه تختار Google نصًا من الصفحة، ونادرًا ما يقنع أحدًا بالدخول.",
    ),
    fix: t("Write one or two sentences (70 to 160 characters) about what you sell and why to buy from you.", "اكتب جملة أو جملتين (من 70 إلى 160 حرفًا) عمّا تبيعه ولماذا يشتري العميل منك."),
    platform: {
      shopify: t("In Shopify: Online Store, Preferences, Title and meta description.", "في شوبيفاي: Online Store ثم Preferences ثم Title and meta description."),
      woocommerce: t("Use an SEO plugin such as Yoast SEO or Rank Math to set it.", "استخدم إضافة SEO مثل Yoast SEO أو Rank Math لضبطه."),
      wordpress: t("Use an SEO plugin such as Yoast SEO or Rank Math to set it.", "استخدم إضافة SEO مثل Yoast SEO أو Rank Math لضبطه."),
    },
  },
  h1: {
    title: {
      pass: t("One main heading", "عنوان رئيسي واحد"),
      warn: (v) => t(`${v.n} main headings (H1) on one page`, `${arCount(n(v, "n"), HEADINGS)} (H1) في صفحة واحدة`),
      fail: t("No main heading (H1)", "لا يوجد عنوان رئيسي (H1)"),
    },
    why: t("The main heading tells search engines what the page is about. One clear H1 is the convention.", "العنوان الرئيسي يخبر محركات البحث بموضوع الصفحة، والمتعارف عليه عنوان H1 واحد واضح."),
    fix: t("Make your store name or main message the only H1, and use H2 for section titles.", "اجعل اسم متجرك أو رسالتك الأساسية هو عنوان H1 الوحيد، واستخدم H2 لعناوين الأقسام."),
  },
  img_alt: {
    title: {
      pass: (v) => t(`${v.pct}% of images have a description (alt text)`, `${v.pct}% من الصور لها وصف (نص بديل)`),
      warn: (v) => t(`Only ${v.pct}% of images have a description (alt text)`, `${v.pct}% فقط من الصور لها وصف (نص بديل)`),
      fail: (v) => t(`Only ${v.pct}% of images have a description (alt text)`, `${v.pct}% فقط من الصور لها وصف (نص بديل)`),
    },
    why: t(
      "Alt text is how Google Images and screen readers understand a photo. For a store, it's free search traffic for product names.",
      "النص البديل هو ما تفهم به صور Google وقارئات الشاشة محتوى الصورة. للمتجر هو زيارات مجانية من البحث بأسماء المنتجات.",
    ),
    fix: t('Describe each product photo in a few words, like "Black oud perfume, 50 ml bottle".', "صف كل صورة منتج بكلمات قليلة، مثل «عطر عود أسود، زجاجة 50 مل»."),
  },
  open_graph: {
    title: {
      pass: t("Link previews are set up", "معاينة الروابط مُعدّة"),
      warn: (v) => t(`Link previews are missing ${v.missing}`, `معاينة الروابط ينقصها ${v.missing}`),
      fail: t("No link preview tags", "لا توجد وسوم لمعاينة الروابط"),
    },
    why: t(
      "When someone shares your store on WhatsApp, Instagram or X, these tags decide the picture and title in the preview.",
      "عندما يشارك أحد رابط متجرك في واتساب أو إنستغرام أو X، هذه الوسوم تحدد الصورة والعنوان في المعاينة.",
    ),
    fix: t("Add og:title, og:description and og:image (1200 × 630 pixels). Most themes have a social sharing image setting.", "أضف og:title وog:description وog:image (بمقاس 1200 × 630 بكسل). أغلب القوالب فيها خيار لصورة المشاركة."),
  },
  robots_txt: {
    title: {
      pass: t("robots.txt is in place", "ملف robots.txt موجود"),
      warn: (v) => (v.what === "product" ? t("robots.txt blocks product pages from search engines", "ملف robots.txt يحجب صفحات المنتجات عن محركات البحث") : t("No robots.txt", "لا يوجد ملف robots.txt")),
      fail: t("robots.txt blocks this page from search engines", "ملف robots.txt يحجب هذه الصفحة عن محركات البحث"),
    },
    why: t("robots.txt tells crawlers what to skip. A missing file is harmless; one that blocks everything hides the store from Google.", "يخبر robots.txt محركات البحث بما تتجاهله. غيابه لا يضر، أما إن حجب كل شيء فسيختفي المتجر من Google."),
    fix: t('Remove the Disallow rule that covers your pages (often a leftover "Disallow: /"), and list your sitemap in the file.', "احذف قاعدة Disallow التي تشمل صفحاتك (غالبًا «Disallow: /» متبقية من فترة الإنشاء)، وأضف رابط خريطة الموقع في الملف."),
  },
  sitemap: {
    title: { pass: t("Sitemap found", "خريطة الموقع موجودة"), warn: t("No sitemap found", "لم نجد خريطة للموقع") },
    why: t("A sitemap lists every product and page so search engines find new products quickly.", "خريطة الموقع تسرد كل المنتجات والصفحات لتجد محركات البحث المنتجات الجديدة بسرعة."),
    fix: t("Most platforms create /sitemap.xml automatically; make sure it's reachable and listed in robots.txt.", "معظم المنصات تنشئ ‎/sitemap.xml تلقائيًا؛ تأكد أنه متاح ومذكور في robots.txt."),
    platform: {
      woocommerce: t("Yoast SEO and Rank Math both generate a sitemap.", "إضافتا Yoast SEO وRank Math تنشئان خريطة الموقع."),
      wordpress: t("WordPress makes one at /wp-sitemap.xml; Yoast SEO and Rank Math make richer ones.", "ووردبريس ينشئ خريطة في ‎/wp-sitemap.xml، وتنشئ Yoast SEO وRank Math خرائط أشمل."),
    },
  },
  canonical: {
    title: { pass: t("Canonical address is set", "العنوان الأساسي (canonical) محدد"), warn: t("No canonical address", "لا يوجد عنوان أساسي (canonical)") },
    why: t(
      "When the same page is reachable at several addresses (with tracking codes, filters, with and without www), the canonical tag tells search engines which one counts.",
      "عندما يمكن الوصول للصفحة نفسها بعدة روابط (برموز تتبع أو فلاتر أو مع www وبدونها)، يخبر وسم canonical محركات البحث أيها المعتمد.",
    ),
    fix: t('Add <link rel="canonical"> pointing to the clean address. Store themes usually do this automatically.', 'أضف ‎<link rel="canonical">‎ يشير إلى الرابط النظيف. قوالب المتاجر تفعل ذلك عادةً تلقائيًا.'),
  },
  structured_data: {
    title: {
      pass: (v) => t(`Structured data found (${v.types})`, `بيانات منظمة موجودة (${v.types})`),
      warn: t("No structured data on the home page", "لا توجد بيانات منظمة في الصفحة الرئيسية"),
    },
    why: t("Structured data (JSON-LD) helps Google show your store's name, logo and search box in results.", "البيانات المنظمة (JSON-LD) تساعد Google على إظهار اسم متجرك وشعاره ومربع البحث في النتائج."),
    fix: t("Add Organization or OnlineStore JSON-LD with your name, logo and social profiles.", "أضف JSON-LD من نوع Organization أو OnlineStore يضم اسمك وشعارك وحساباتك."),
  },
  product_schema: {
    title: {
      pass: t("Product pages give Google the price and stock", "صفحات المنتجات تعطي Google السعر والتوفر"),
      warn: t("Product data has no price", "بيانات المنتج بدون سعر"),
      fail: t("Product pages have no product data for Google", "صفحات المنتجات بدون بيانات منتج لـ Google"),
    },
    why: t(
      "Product structured data lets Google show price, stock and ratings right in search results, which brings more clicks.",
      "بيانات المنتج المنظمة تسمح لـ Google بعرض السعر والتوفر والتقييم مباشرة في النتائج، فتزيد النقرات.",
    ),
    fix: t("Add Product JSON-LD with name, image, price, currency and availability. Most store themes include it; check yours does.", "أضف JSON-LD من نوع Product بالاسم والصورة والسعر والعملة والتوفر. أغلب قوالب المتاجر تتضمنه؛ تأكد أن قالبك يفعل."),
  },
  hreflang: {
    title: {
      pass: t("Language versions are linked for search engines", "نسخ اللغات مربوطة لمحركات البحث"),
      warn: t("Arabic and English versions aren't linked for search engines", "النسختان العربية والإنجليزية غير مربوطتين لمحركات البحث"),
    },
    why: t("hreflang tags tell Google which version to show to Arabic and English searchers.", "وسوم hreflang تخبر Google أي نسخة تُعرض لمن يبحث بالعربية ومن يبحث بالإنجليزية."),
    fix: t('Add <link rel="alternate" hreflang="ar"> and hreflang="en" tags on each page.', 'أضف وسوم ‎<link rel="alternate" hreflang="ar">‎ وhreflang="en"‎ في كل صفحة.'),
  },
  favicon: {
    title: { pass: t("Site icon is set", "أيقونة الموقع موجودة"), warn: t("No site icon", "لا توجد أيقونة للموقع") },
    why: t("The small icon shows in browser tabs, bookmarks and Google's mobile results.", "الأيقونة الصغيرة تظهر في تبويبات المتصفح والمفضلة ونتائج Google على الجوال."),
    fix: t("Upload a square logo as the favicon in your theme or store settings.", "ارفع شعارًا مربعًا كأيقونة للموقع من إعدادات القالب أو المتجر."),
  },

  /* ------------------------------- trust ------------------------------- */
  https: {
    title: { pass: t("Served securely over HTTPS", "المتجر يعمل باتصال آمن (HTTPS)"), fail: t("The store isn't served over HTTPS", "المتجر لا يعمل باتصال آمن (HTTPS)") },
    why: t("Browsers mark plain HTTP pages \"Not secure\", and shoppers won't type card details there.", "المتصفحات تصف صفحات HTTP بأنها «غير آمنة»، ولن يكتب العميل بيانات بطاقته فيها."),
    fix: t("Turn on SSL for your domain; most hosts and platforms include a free certificate.", "فعّل SSL لنطاقك؛ أغلب الاستضافات والمنصات توفر شهادة مجانية."),
  },
  http_redirect: {
    title: { pass: t("Visitors typing http:// land on the secure address", "من يكتب http://‎ يُحوَّل للعنوان الآمن"), warn: t("http:// visitors aren't sent to https://", "زوار http://‎ لا يُحوَّلون إلى https://‎") },
    why: t("People who type your address without https should still land on the secure version.", "من يكتب عنوانك بدون https يجب أن يصل للنسخة الآمنة رغم ذلك."),
    fix: t('Turn on "Always use HTTPS" or a permanent (301) redirect at your host or CDN.', "فعّل خيار «Always use HTTPS» أو تحويلًا دائمًا (301) في الاستضافة أو CDN."),
  },
  ssl_expiry: {
    title: {
      pass: (v) => t(`Security certificate is valid for ${v.days} more days`, `شهادة الأمان صالحة لمدة ${arCount(n(v, "days"), DAYS)} أخرى`),
      warn: (v) => t(`Security certificate expires in ${v.days} days`, `شهادة الأمان تنتهي بعد ${arCount(n(v, "days"), DAYS)}`),
      fail: (v) =>
        n(v, "days") < 0
          ? t("Security certificate has expired", "شهادة الأمان منتهية")
          : n(v, "days") === 0
            ? t("Security certificate expires today", "شهادة الأمان تنتهي اليوم")
            : t(`Security certificate expires in ${v.days} day${n(v, "days") === 1 ? "" : "s"}`, `شهادة الأمان تنتهي بعد ${arCount(n(v, "days"), DAYS)}`),
    },
    why: t("When the certificate expires, browsers show a full-page warning and checkout stops.", "عند انتهاء الشهادة تعرض المتصفحات تحذيرًا يغطي الصفحة ويتوقف الدفع."),
    fix: t("Renew it, or switch on automatic renewal. Let's Encrypt and most platforms renew automatically.", "جدّدها أو فعّل التجديد التلقائي. Let's Encrypt وأغلب المنصات تجدد تلقائيًا."),
  },
  contact: {
    title: {
      pass: (v) => t(`Shoppers can reach you (${v.ways})`, `يمكن للعملاء التواصل معك (${String(v.ways).replace("phone", "هاتف").replace("email", "بريد").replace("WhatsApp", "واتساب")})`),
      fail: t("No phone, email or WhatsApp link on the home page", "لا يوجد رابط هاتف أو بريد أو واتساب في الصفحة الرئيسية"),
    },
    why: t("Shoppers buying from a store they don't know look for a way to ask a question first.", "من يشتري من متجر لا يعرفه يبحث أولًا عن طريقة ليسأل."),
    fix: t("Add a tappable phone number, email or WhatsApp link to the header or footer.", "أضف رقم هاتف أو بريدًا أو رابط واتساب قابلًا للضغط في أعلى الصفحة أو أسفلها."),
  },
  whatsapp: {
    title: { pass: t("WhatsApp is one tap away", "واتساب على بعد ضغطة"), warn: t("No WhatsApp link", "لا يوجد رابط واتساب") },
    why: t("In the Gulf and Egypt, many shoppers would rather send a WhatsApp message than call or email.", "في الخليج ومصر يفضّل كثير من العملاء رسالة واتساب على الاتصال أو البريد."),
    fix: t("Link to wa.me/ followed by your full number in international format without + or leading zeros, for example wa.me/9665XXXXXXXX.", "أضف رابطًا إلى wa.me/‎ متبوعًا برقمك بالصيغة الدولية بدون + أو أصفار في البداية، مثل wa.me/9665XXXXXXXX."),
  },
  return_policy: {
    title: { pass: t("Return policy is linked", "سياسة الاسترجاع موجودة"), fail: t("No return or exchange policy link", "لا يوجد رابط لسياسة الاسترجاع أو الاستبدال") },
    why: t("A clear return policy is one of the strongest reasons a first-time shopper decides to buy.", "سياسة استرجاع واضحة من أقوى ما يدفع العميل الجديد لاتخاذ قرار الشراء."),
    fix: t("Add a returns and exchanges page and link it in the footer.", "أضف صفحة للاسترجاع والاستبدال واربطها في أسفل الموقع."),
    platform: {
      shopify: t("Shopify can draft one under Settings, Policies; then add it to your footer menu.", "شوبيفاي يقدم مسودة من Settings ثم Policies؛ ثم أضفها إلى قائمة أسفل الموقع."),
      salla: t("Create it as a page in your Salla dashboard and add it to the footer menu.", "أنشئها كصفحة من لوحة تحكم سلة وأضفها إلى قائمة أسفل الموقع."),
      zid: t("Create it as a page in your Zid dashboard and add it to the footer menu.", "أنشئها كصفحة من لوحة تحكم زد وأضفها إلى قائمة أسفل الموقع."),
    },
  },
  shipping_info: {
    title: { pass: t("Shipping information is linked", "معلومات الشحن موجودة"), warn: t("No shipping or delivery information link", "لا يوجد رابط لمعلومات الشحن أو التوصيل") },
    why: t("Shoppers want to know delivery areas, times and costs before they reach checkout.", "العميل يريد معرفة مناطق التوصيل ومدته وتكلفته قبل الوصول إلى الدفع."),
    fix: t("Add a shipping page with areas, delivery times and costs, and link it in the footer.", "أضف صفحة للشحن فيها المناطق ومدة التوصيل والتكلفة، واربطها في أسفل الموقع."),
  },
  privacy_policy: {
    title: { pass: t("Privacy policy is linked", "سياسة الخصوصية موجودة"), warn: t("No privacy policy link", "لا يوجد رابط لسياسة الخصوصية") },
    why: t("Shoppers expect one, and ad platforms such as Google and Meta ask for it.", "العملاء يتوقعونها، ومنصات الإعلانات مثل Google وMeta تطلبها."),
    fix: t("Add a privacy policy page and link it in the footer.", "أضف صفحة لسياسة الخصوصية واربطها في أسفل الموقع."),
  },
  payment_methods: {
    title: { pass: (v) => t(`Payment options are shown (${v.list})`, `طرق الدفع ظاهرة (${v.list})`), warn: t("No payment methods shown on the home page", "لا تظهر طرق الدفع في الصفحة الرئيسية") },
    why: t("Seeing familiar options like mada, Apple Pay, Tabby or cash on delivery reassures shoppers before they add to cart.", "رؤية خيارات مألوفة مثل مدى وApple Pay وتابي والدفع عند الاستلام تطمئن العميل قبل الإضافة للسلة."),
    fix: t("Show the logos of the payment methods you accept in the footer.", "اعرض شعارات طرق الدفع التي تقبلها في أسفل الموقع."),
  },
  business_identity: {
    title: {
      pass: (v) => t(`Business details are shown (${v.list})`, `بيانات النشاط التجاري ظاهرة (${String(v.list).replace("Commercial registration", "السجل التجاري").replace("VAT number", "الرقم الضريبي").replace("Maroof", "معروف").replace("Saudi Business Center", "المركز السعودي للأعمال")})`),
      warn: t("No commercial registration or tax number shown", "لا يظهر السجل التجاري أو الرقم الضريبي"),
    },
    why: t(
      "A commercial registration or VAT number signals a registered business, and Saudi e-commerce rules expect stores to show them.",
      "السجل التجاري أو الرقم الضريبي دليل على نشاط مسجّل، وأنظمة التجارة الإلكترونية في السعودية تتوقع ظهورهما في المتجر.",
    ),
    fix: t("Add your registration and VAT numbers to the footer, with any trust badges you hold.", "أضف رقم السجل والرقم الضريبي في أسفل الموقع، مع أي شارات توثيق لديك."),
  },
  social_links: {
    title: { pass: (v) => t(`Social accounts are linked (${v.list})`, `حسابات التواصل مربوطة (${v.list})`), warn: t("No social media links", "لا توجد روابط لحسابات التواصل") },
    why: t("Active Instagram, TikTok or Snapchat accounts are how many shoppers check that a store is real.", "حسابات نشطة في إنستغرام أو تيك توك أو سناب شات هي ما يتأكد به كثيرون أن المتجر حقيقي."),
    fix: t("Link your social accounts in the header or footer.", "اربط حساباتك في أعلى الموقع أو أسفله."),
  },
  broken_links: {
    title: {
      pass: (v) => t(`No broken links among the ${v.checked} we followed`, `لا روابط معطلة بين ${v.checked} رابطًا تتبعناها`),
      warn: (v) => t(`${v.n} broken link${n(v, "n") === 1 ? "" : "s"} on the home page`, `${arCount(n(v, "n"), LINKS)} في الصفحة الرئيسية`),
      fail: (v) => t(`${v.n} broken links on the home page`, `${arCount(n(v, "n"), LINKS)} في الصفحة الرئيسية`),
    },
    why: t("Broken links send shoppers to error pages and waste search engines' time.", "الروابط المعطلة ترسل العملاء إلى صفحات خطأ وتهدر وقت محركات البحث."),
    fix: t("Fix or remove the links listed.", "أصلح الروابط المذكورة أو احذفها."),
  },
  product_price: {
    title: { pass: t("Product pages show the price", "صفحات المنتجات تعرض السعر"), warn: t("We couldn't find a price on the product page", "لم نجد سعرًا في صفحة المنتج") },
    why: t("Shoppers leave pages where the price is hidden or only appears after a tap.", "العملاء يغادرون الصفحات التي يكون فيها السعر مخفيًا أو لا يظهر إلا بعد ضغطة."),
    fix: t("Show the price, with its currency, next to the product name. If it's loaded by JavaScript, also put it in the page itself.", "اعرض السعر بعملته بجانب اسم المنتج. وإن كان يُحمّل عبر JavaScript فضعه أيضًا في كود الصفحة."),
  },
  add_to_cart: {
    title: { pass: t("Product pages have an add-to-cart button", "صفحات المنتجات فيها زر الإضافة للسلة"), warn: t("No add-to-cart button found on the product page", "لم نجد زر الإضافة للسلة في صفحة المنتج") },
    why: t("The buy button should be obvious and reachable without scrolling on a phone.", "زر الشراء يجب أن يكون واضحًا ويمكن الوصول إليه بدون تمرير على الجوال."),
    fix: t('Use a clear button such as "Add to cart" or "أضف إلى السلة" near the price.', "استخدم زرًا واضحًا مثل «أضف إلى السلة» قرب السعر."),
  },

  /* --------------------------- mobile & arabic -------------------------- */
  viewport: {
    title: { pass: t("The store fits phone screens", "المتجر يناسب شاشات الجوال"), fail: t("No mobile viewport tag: phones show a shrunken desktop page", "لا يوجد وسم viewport: الجوال يعرض نسخة سطح مكتب مصغّرة") },
    why: t("Without it, phones draw the desktop layout zoomed out, and Google treats the page as not mobile-friendly.", "بدونه يعرض الجوال تصميم سطح المكتب مصغرًا، وتعتبر Google الصفحة غير متوافقة مع الجوال."),
    fix: t('Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the page head.', 'أضف ‎<meta name="viewport" content="width=device-width, initial-scale=1">‎ في رأس الصفحة.'),
  },
  zoom: {
    title: { pass: t("Shoppers can zoom in", "يمكن للعملاء التكبير"), warn: t("Zooming in is turned off", "التكبير متوقف في الصفحة") },
    why: t("Blocking zoom makes small text and product details hard to read, especially for older shoppers.", "منع التكبير يجعل النصوص الصغيرة وتفاصيل المنتج صعبة القراءة، خاصة لكبار السن."),
    fix: t("Remove maximum-scale=1 and user-scalable=no from the viewport tag.", "احذف maximum-scale=1 وuser-scalable=no من وسم viewport."),
  },
  rtl: {
    title: { pass: t("Arabic pages read right to left", "الصفحات العربية تُقرأ من اليمين لليسار"), fail: t("Arabic text, but the page is laid out left to right", "نص عربي لكن الصفحة مصممة من اليسار لليمين") },
    why: t('Without dir="rtl", Arabic text, punctuation and layout line up the wrong way.', 'بدون dir="rtl" تنعكس محاذاة النص العربي وعلامات الترقيم والتصميم.'),
    fix: t('Set dir="rtl" (and lang="ar") on the <html> tag for Arabic pages.', 'ضع dir="rtl"‎ وlang="ar"‎ في وسم ‎<html>‎ للصفحات العربية.'),
  },
  lang_attr: {
    title: { pass: (v) => t(`Page language is declared (${v.lang})`, `لغة الصفحة محددة (${v.lang})`), warn: t("Page language isn't declared", "لغة الصفحة غير محددة") },
    why: t("The lang attribute tells browsers and screen readers which language to read and which fonts to use.", "خاصية lang تخبر المتصفح وقارئات الشاشة بلغة الصفحة والخطوط المناسبة لها."),
    fix: t('Set lang="ar" or lang="en" on the <html> tag.', 'ضع lang="ar"‎ أو lang="en"‎ في وسم ‎<html>‎.'),
  },
  touch_icon: {
    title: { pass: t("Home-screen icon is set", "أيقونة الشاشة الرئيسية موجودة"), warn: t("No home-screen icon", "لا توجد أيقونة للشاشة الرئيسية") },
    why: t("When a shopper adds your store to their phone's home screen, this icon is what they see.", "عندما يضيف العميل متجرك إلى الشاشة الرئيسية لجواله، هذه الأيقونة هي ما يراه."),
    fix: t("Add an apple-touch-icon of 180 × 180 pixels.", "أضف أيقونة apple-touch-icon بمقاس 180 × 180 بكسل."),
  },
  arabic_version: {
    title: { info: t("No Arabic version found", "لم نجد نسخة عربية") },
    why: t("Most shoppers in the Gulf and Egypt browse in Arabic. An Arabic version usually sells better there than English alone.", "أغلب المتسوقين في الخليج ومصر يتصفحون بالعربية، والنسخة العربية تبيع هناك عادةً أفضل من الإنجليزية وحدها."),
    fix: t("If you sell in the region, add an Arabic version with its own addresses (like /ar).", "إن كنت تبيع في المنطقة، أضف نسخة عربية بروابط خاصة بها (مثل ‎/ar)."),
  },

  /* ------------------------------ security ----------------------------- */
  hsts: {
    title: { pass: t("Browsers are told to always use HTTPS (HSTS)", "المتصفحات مُلزمة باستخدام HTTPS دائمًا (HSTS)"), warn: t("No HSTS header", "لا يوجد ترويسة HSTS") },
    why: t("HSTS stops a browser from ever loading your store over an insecure connection, even from an old link.", "HSTS يمنع المتصفح من فتح متجرك باتصال غير آمن أبدًا، حتى من رابط قديم."),
    fix: t("Send the Strict-Transport-Security header; Cloudflare and most hosts have a switch for it.", "أرسل ترويسة Strict-Transport-Security؛ في Cloudflare ومعظم الاستضافات خيار لها."),
  },
  mixed_content: {
    title: { pass: t("No insecure files on the secure page", "لا ملفات غير آمنة في الصفحة الآمنة"), fail: (v) => t(`${v.n} file${n(v, "n") === 1 ? "" : "s"} load${n(v, "n") === 1 ? "s" : ""} over insecure http://`, `${arCount(n(v, "n"), FILES)} عبر http://‎ غير الآمن`) },
    why: t("Browsers block or flag insecure files on a secure page, which can break images and scripts and remove the padlock.", "المتصفحات تحجب الملفات غير الآمنة في الصفحة الآمنة أو تحذر منها، فقد تتعطل الصور والسكربتات ويختفي القفل."),
    fix: t("Change the listed addresses to https://.", "غيّر الروابط المذكورة إلى https://‎."),
  },
  nosniff: {
    title: { pass: t("File types can't be guessed (nosniff)", "أنواع الملفات محمية من التخمين (nosniff)"), warn: t("X-Content-Type-Options is missing", "ترويسة X-Content-Type-Options غير موجودة") },
    why: t("This header stops browsers from guessing file types, which closes a whole class of attacks.", "هذه الترويسة تمنع المتصفح من تخمين نوع الملف، فتغلق بابًا لنوع كامل من الهجمات."),
    fix: t("Send X-Content-Type-Options: nosniff on every response.", "أرسل X-Content-Type-Options: nosniff مع كل استجابة."),
  },
  clickjacking: {
    title: { pass: t("Other sites can't frame your store", "لا يمكن لمواقع أخرى عرض متجرك داخل إطار"), warn: t("Other sites can show your store inside a frame", "يمكن لمواقع أخرى عرض متجرك داخل إطار") },
    why: t("A hostile site could show your store inside a frame and trick shoppers into clicking.", "قد يعرض موقع مسيء متجرك داخل إطار ويخدع العملاء ليضغطوا على أشياء."),
    fix: t("Send X-Frame-Options: SAMEORIGIN, or a Content-Security-Policy with frame-ancestors.", "أرسل X-Frame-Options: SAMEORIGIN أو Content-Security-Policy مع frame-ancestors."),
  },
  referrer: {
    title: { pass: t("Referrer policy is set", "سياسة المُحيل محددة"), warn: t("No referrer policy", "لا توجد سياسة للمُحيل") },
    why: t("It limits how much of your page addresses, which can include search terms or order details, is shared with other sites.", "تحدّ من مشاركة روابط صفحاتك مع المواقع الأخرى، وقد تتضمن كلمات بحث أو تفاصيل طلبات."),
    fix: t("Send Referrer-Policy: strict-origin-when-cross-origin.", "أرسل Referrer-Policy: strict-origin-when-cross-origin."),
  },
  server_leak: {
    title: { pass: t("The server doesn't announce its software", "الخادم لا يعلن عن برمجياته"), warn: (v) => t(`The server announces its software (${v.value})`, `الخادم يعلن عن برمجياته (${v.value})`) },
    why: t("Naming the software, and especially its version, makes it easier for attackers to look up known weaknesses.", "ذكر اسم البرمجيات، وخاصة رقم إصدارها، يسهّل على المهاجمين البحث عن ثغرات معروفة."),
    fix: t("Hide version details in the Server and X-Powered-By headers.", "أخفِ تفاصيل الإصدار في ترويستي Server وX-Powered-By."),
  },
};

/** The sentence for a finding, in one language. */
export function titleOf(f: Finding, lang: Lang): string {
  const c = COPY[f.id];
  const title = c?.title[f.status] ?? c?.title.warn ?? c?.title.pass;
  if (!title) return f.id;
  const vars = { ...(f.vars ?? {}), ...(f.metric ? { value: f.metric.value } : {}) };
  return (typeof title === "function" ? title(vars, lang) : title)[lang];
}

export const whyOf = (id: string, lang: Lang) => COPY[id]?.why[lang] ?? "";
export const fixOf = (id: string, lang: Lang) => COPY[id]?.fix[lang] ?? "";
export const platformNoteOf = (id: string, platform: PlatformId | null, lang: Lang) => (platform ? (COPY[id]?.platform?.[platform]?.[lang] ?? null) : null);
