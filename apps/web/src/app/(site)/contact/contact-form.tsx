"use client";

import { FormEvent, useState } from "react";
import { contactPublicApi } from "@/lib/api";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    if (name.trim().length < 2) {
      setError("Indiquez votre nom.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Indiquez une adresse e-mail valide.");
      return;
    }
    if (subject.trim().length < 2) {
      setError("Indiquez un sujet.");
      return;
    }
    if (message.trim().length < 10) {
      setError("Le message est trop court.");
      return;
    }

    setBusy(true);
    try {
      const res = await contactPublicApi.send({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      setDone(res.message);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d’envoyer le message pour le moment.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="opt-contact__form" onSubmit={onSubmit} noValidate>
      <div className="opt-contact__field">
        <input
          id="contact-name"
          type="text"
          name="name"
          autoComplete="name"
          placeholder=" "
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          required
        />
        <label htmlFor="contact-name">Nom</label>
      </div>
      <div className="opt-contact__field">
        <input
          id="contact-email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder=" "
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          required
        />
        <label htmlFor="contact-email">E-mail</label>
      </div>
      <div className="opt-contact__field">
        <input
          id="contact-subject"
          type="text"
          name="subject"
          placeholder=" "
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={busy}
          required
        />
        <label htmlFor="contact-subject">Sujet</label>
      </div>
      <div className="opt-contact__field">
        <textarea
          id="contact-message"
          name="message"
          rows={6}
          placeholder=" "
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={busy}
          required
        />
        <label htmlFor="contact-message">Message</label>
      </div>
      {error ? (
        <p className="opt-contact__error" role="alert">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="opt-contact__success" role="status">
          {done}
        </p>
      ) : null}
      <button type="submit" className="opt-contact__submit" disabled={busy}>
        {busy ? "Envoi…" : "Envoyer"}
      </button>
    </form>
  );
}
