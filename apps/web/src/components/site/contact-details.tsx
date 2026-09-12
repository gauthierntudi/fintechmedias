"use client";

import { useEffect, useState } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { settingsPublicApi } from "@/lib/api";

export function ContactDetails({
  className = "opt-contact__details",
  iconSize = 16,
}: {
  className?: string;
  iconSize?: number;
}) {
  const [address, setAddress] = useState<string>(BRAND.address);
  const [email, setEmail] = useState<string>(BRAND.email);
  const [phone, setPhone] = useState<string>(BRAND.phone);

  useEffect(() => {
    let cancelled = false;
    settingsPublicApi
      .contact()
      .then((res) => {
        if (cancelled) return;
        if (res.address) setAddress(res.address);
        if (res.email) setEmail(res.email);
        if (res.phone) setPhone(res.phone);
      })
      .catch(() => {
        /* garder les valeurs BRAND */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ul className={className}>
      <li>
        <MapPin size={iconSize} strokeWidth={1.75} aria-hidden />
        <span>{address}</span>
      </li>
      <li>
        <Mail size={iconSize} strokeWidth={1.75} aria-hidden />
        <a href={`mailto:${email}`}>{email}</a>
      </li>
      <li>
        <Phone size={iconSize} strokeWidth={1.75} aria-hidden />
        <a href={`tel:${phone.replace(/\s/g, "")}`}>{phone}</a>
      </li>
    </ul>
  );
}
