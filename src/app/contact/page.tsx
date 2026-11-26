import { getPublicSiteConfig } from "@/lib/site-config";
import { ContactFormClient } from "@/components/store/contact-form-client";
import { MapPin, Phone, Mail, MessageCircle, Sparkles } from "lucide-react";

export const revalidate = 60;

export default async function ContactPage() {
  const siteConfig = await getPublicSiteConfig();
  const c = siteConfig.contact;
  const whatsappUrl = c.whatsappNumber
    ? `https://wa.me/${c.whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        `Hello ${siteConfig.brandName}, I have a trade/retail inquiry.`
      )}`
    : null;

  return (
    <div className="bg-canvas py-12 sm:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="max-w-2xl space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gold-500/12 border border-gold-500/30 text-gold-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Trade &amp; Retail Support Desk
          </span>
          <h1 className="text-3xl sm:text-4xl font-heading font-extrabold text-ink">
            Connect with {siteConfig.brandName}
          </h1>
          <p className="text-sm text-ink-secondary leading-relaxed">
            Reach out for B2B bulk pricing, seller KYC onboarding, or customer order assistance.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-4">
            <div className="luxury-card rounded-3xl p-6 space-y-5 text-xs">
              {c.address || c.phone || c.email ? (
                <>
                  {c.address && (
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-gold-500/12 border border-gold-500/30 text-gold-400 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-sm font-heading font-bold text-ink">Headquarters</h2>
                        <p className="text-ink-secondary mt-1">{c.address}</p>
                      </div>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-gold-500/12 border border-gold-500/30 text-gold-400 flex items-center justify-center shrink-0">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-sm font-heading font-bold text-ink">Phone Desk</h2>
                        <p className="text-ink-secondary mt-1 font-mono">{c.phone}</p>
                      </div>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-gold-500/12 border border-gold-500/30 text-gold-400 flex items-center justify-center shrink-0">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-sm font-heading font-bold text-ink">Email</h2>
                        <p className="text-ink-secondary mt-1 font-mono">{c.email}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-ink-muted">
                  Store contact channels can be updated in Admin -&gt; CMS &amp; Settings.
                </p>
              )}

              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  Chat on WhatsApp
                </a>
              )}
            </div>
          </div>

          <div className="lg:col-span-7">
            <ContactFormClient />
          </div>
        </div>
      </div>
    </div>
  );
}
