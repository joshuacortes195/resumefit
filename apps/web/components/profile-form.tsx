"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { saveProfileAction } from "@/app/actions/profile";
import { CARD, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DEGREES, EEO_OPTIONS, JOB_TYPES, PRONOUNS, REMOTE_PREFERENCES, WORK_AUTHORIZATIONS, type Profile, type ProfileInput } from "@/lib/profile";

// turns the saved profile into the plain strings a form works with
function toForm(profile: Profile): ProfileInput {
  const yesNo = (value: boolean | null) => (value === null ? "" : value ? "yes" : "no");
  return {
    fullName: profile.fullName ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    city: profile.city ?? "",
    state: profile.state ?? "",
    country: profile.country ?? "",
    zip: profile.zip ?? "",
    linkedinUrl: profile.linkedinUrl ?? "",
    githubUrl: profile.githubUrl ?? "",
    portfolioUrl: profile.portfolioUrl ?? "",
    otherLinks: profile.otherLinks,
    yearsExperience: profile.yearsExperience === null ? "" : String(profile.yearsExperience),
    workAuthorization: profile.workAuthorization ?? "",
    needsSponsorship: yesNo(profile.needsSponsorship),
    willingToRelocate: yesNo(profile.willingToRelocate),
    desiredSalaryMin: profile.desiredSalaryMin === null ? "" : String(profile.desiredSalaryMin),
    desiredSalaryMax: profile.desiredSalaryMax === null ? "" : String(profile.desiredSalaryMax),
    earliestStartDate: profile.earliestStartDate ?? "",
    jobTypes: profile.jobTypes,
    preferredIndustries: profile.preferredIndustries,
    remotePreference: profile.remotePreference ?? "",
    eeoGender: profile.eeoGender,
    eeoRace: profile.eeoRace,
    eeoVeteran: profile.eeoVeteran,
    eeoDisability: profile.eeoDisability,
    qaBank: profile.qaBank,
    preferredName: profile.preferredName ?? "",
    pronouns: profile.pronouns ?? "",
    streetAddress: profile.streetAddress ?? "",
    over18: yesNo(profile.over18),
    howHeard: profile.howHeard ?? "",
    noticePeriod: profile.noticePeriod ?? "",
    school: profile.school ?? "",
    degree: profile.degree ?? "",
    major: profile.major ?? "",
    graduationYear: profile.graduationYear ?? "",
    gpa: profile.gpa ?? "",
    eeoHispanic: profile.eeoHispanic,
  };
}

// labels for the demographic questions
const EEO_LABELS: Record<keyof typeof EEO_OPTIONS, string> = { eeoGender: "Gender", eeoHispanic: "Are you Hispanic or Latino?", eeoRace: "Race or ethnicity", eeoVeteran: "Veteran status", eeoDisability: "Disability" };

// the one application form, this is what autofill types into real applications
export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [form, setForm] = useState<ProfileInput>(() => toForm(profile));
  // what the form looked like when it was last saved, to tell whether anything changed
  const [saved, setSaved] = useState(() => JSON.stringify(toForm(profile)));
  const dirty = useMemo(() => JSON.stringify(form) !== saved, [form, saved]);
  const [leaving, setLeaving] = useState(false);

  // closing the tab or reloading with unsaved changes asks first
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<ProfileInput>) => setForm((current) => ({ ...current, ...patch }));

  // a plain text box bound to one field
  const text = (key: keyof ProfileInput, label: string, options: { type?: string; placeholder?: string } = {}) => (
    <label className="block text-sm font-medium">
      {label}
      <input type={options.type ?? "text"} placeholder={options.placeholder} value={form[key] as string} onChange={(event) => set({ [key]: event.target.value })} className={`${INPUT} mt-1 font-normal`} />
    </label>
  );
  // a dropdown bound to one field
  const select = (key: keyof ProfileInput, label: string, options: readonly (string | [string, string])[]) => (
    <label className="block text-sm font-medium">
      {label}
      <select value={form[key] as string} onChange={(event) => set({ [key]: event.target.value })} className={`${INPUT} mt-1 font-normal`}>
        {options.map((option) => {
          const [value, shown] = typeof option === "string" ? [option, option || "Not answered"] : option;
          return (
            <option key={value} value={value}>
              {shown}
            </option>
          );
        })}
      </select>
    </label>
  );
  const YES_NO: [string, string][] = [
    ["", "Not answered"],
    ["yes", "Yes"],
    ["no", "No"],
  ];

  function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await saveProfileAction(form);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      // saved: nothing is unsaved any more, and it is back to Auto Apply
      setSaved(JSON.stringify(form));
      setMessage({ ok: true, text: "Saved" });
      router.push("/auto-apply");
    });
  }

  return (
    <div className="space-y-4">
      {/* back to Auto Apply. it does not save, so it asks first when something was changed */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={() => (dirty ? setLeaving(true) : router.push("/auto-apply"))} className={`group ${SECONDARY_BUTTON} px-3 py-2`}>
          <ArrowLeft className="size-4 transition-transform duration-200 ease-settle group-hover:-translate-x-0.5" aria-hidden />
          Back
        </button>
        <p className="text-sm text-muted">Going back does not save your changes. Press Finished at the bottom to keep them.</p>
      </div>

      <form id="profile" onSubmit={save} className={`${CARD} scroll-mt-20 space-y-8 p-6`}>
        <div>
          <h1 className="text-2xl font-semibold">Your one application</h1>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Fill this in once, like a job application, and Auto Apply answers the same questions on every real one. Anything you leave empty is left for you to fill in on the form.
          </p>
        </div>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 font-semibold">Contact</legend>
          {text("fullName", "Full name")}
          {text("preferredName", "Preferred first name", { placeholder: "Only if it differs" })}
          {select("pronouns", "Pronouns", PRONOUNS)}
          {text("email", "Email", { type: "email" })}
          {text("phone", "Phone", { type: "tel" })}
          {text("streetAddress", "Street address")}
          {text("city", "City")}
          {text("state", "State or region")}
          {text("zip", "ZIP or postal code")}
          {text("country", "Country")}
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 font-semibold">Links</legend>
          {text("linkedinUrl", "LinkedIn", { placeholder: "https://linkedin.com/in/you" })}
          {text("githubUrl", "GitHub", { placeholder: "https://github.com/you" })}
          {text("portfolioUrl", "Portfolio or website", { placeholder: "https://" })}
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 font-semibold">Work details</legend>
          {text("yearsExperience", "Years of experience", { placeholder: "4" })}
          {select("workAuthorization", "Work authorization", WORK_AUTHORIZATIONS)}
          {select("needsSponsorship", "Will you need visa sponsorship?", YES_NO)}
          {select("willingToRelocate", "Willing to relocate?", YES_NO)}
          {select("over18", "Are you 18 or older?", YES_NO)}
          {text("noticePeriod", "Notice period", { placeholder: "2 weeks" })}
          {text("howHeard", "How you usually hear about jobs", { placeholder: "LinkedIn" })}
          {text("desiredSalaryMin", "Desired salary, lowest", { placeholder: "85000" })}
          {text("desiredSalaryMax", "Desired salary, highest", { placeholder: "105000" })}
          {text("earliestStartDate", "Earliest start date", { type: "date" })}
          {select("remotePreference", "Remote preference", ["", ...REMOTE_PREFERENCES.slice(1)])}
          <div className="sm:col-span-2">
            <p className="text-sm font-medium">Job types</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {JOB_TYPES.map((type) => {
                const on = form.jobTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ jobTypes: on ? form.jobTypes.filter((entry) => entry !== type) : [...form.jobTypes, type] })}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors duration-150 ${on ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-primary-soft/60"}`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block text-sm font-medium sm:col-span-2">
            Preferred industries
            <input
              value={form.preferredIndustries.join(", ")}
              onChange={(event) => set({ preferredIndustries: event.target.value.split(",").map((item) => item.trimStart()) })}
              placeholder="Healthcare, Education, Software"
              className={`${INPUT} mt-1 font-normal`}
            />
            <span className="mt-1 block text-xs font-normal text-muted">Separate them with commas.</span>
          </label>
        </fieldset>

        {/* school questions come up on most forms */}
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 font-semibold">Education</legend>
          {text("school", "School", { placeholder: "State University" })}
          {select("degree", "Degree", DEGREES)}
          {text("major", "Major or field of study", { placeholder: "Computer Science" })}
          {text("graduationYear", "Graduation year", { placeholder: "2026" })}
          {text("gpa", "GPA", { placeholder: "Optional" })}
        </fieldset>

        {/* these start on "decline" and are never guessed */}
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-1 font-semibold">Voluntary self-identification</legend>
          <p className="mb-2 text-sm text-muted sm:col-span-2">Many applications ask about gender, race, veteran status and disability. Answer them here once and we use exactly what you chose. Every one starts on &quot;Decline to self-identify&quot;, and declining is a fine answer.</p>
          {(Object.keys(EEO_OPTIONS) as (keyof typeof EEO_OPTIONS)[]).map((key) => (
            <div key={key}>{select(key, EEO_LABELS[key], EEO_OPTIONS[key])}</div>
          ))}
        </fieldset>

        <div className="flex items-center gap-4 border-t border-border pt-5">
          {/* saves everything and goes back to Auto Apply */}
          <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
            <Check className="size-4" aria-hidden />
            {pending ? "Saving..." : "Finished"}
          </button>
          <p aria-live="polite" className={`text-sm ${message?.ok ? "text-success" : "text-danger"}`}>
            {message?.text}
          </p>
        </div>
      </form>

      {/* asked when Back is pressed with changes that were not saved */}
      <ConfirmDialog
        open={leaving}
        title="Leave without saving?"
        message="Your changes have not been saved and will be lost if you go back. To keep them, stay here and press Finished at the bottom."
        confirmLabel="Leave without saving"
        onConfirm={() => router.push("/auto-apply")}
        onClose={() => setLeaving(false)}
      />
    </div>
  );
}
