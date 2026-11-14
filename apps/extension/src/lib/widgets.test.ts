// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { generic } from "./adapters";
import { fillDropdowns, findYesNo, setDropdown } from "./dropdowns";
import { findFields } from "./fields";
import { captchaKind, companyFromTitle, hasCaptcha, looksConfirmed } from "./job-page";
import { pressAnswer, wouldSubmit } from "./press";

// a search box that opens a list of choices, built the way the newer greenhouse forms build theirs:
// pressing the box shows the list, typing narrows it, and clicking a choice puts it next to the box
function searchBox(label: string, choices: string[], options: { required?: boolean; lookedUp?: boolean } = {}) {
  const id = `q-${document.querySelectorAll('input[role="combobox"]').length}`;
  const wrapper = document.createElement("div");
  wrapper.className = "select";
  wrapper.innerHTML = `<label id="${id}-label" for="${id}">${label}${options.required ? ' <span aria-hidden="true">*</span>' : ""}</label>
    <div class="select-shell"><div class="select__control"><div class="select__placeholder">Select...</div>
    <input id="${id}" class="select__input" type="text" role="combobox" aria-labelledby="${id}-label" aria-required="${options.required ? "true" : "false"}" value=""></div></div>`;
  document.body.append(wrapper);
  const input = wrapper.querySelector("input") as HTMLInputElement;
  const shell = wrapper.querySelector(".select-shell") as HTMLElement;
  const close = () => shell.querySelector(".select__menu")?.remove();
  const open = (filter = "") => {
    close();
    const menu = document.createElement("div");
    menu.className = "select__menu";
    menu.setAttribute("role", "listbox");
    for (const choice of choices.filter((entry) => entry.toLowerCase().includes(filter.toLowerCase()))) {
      const option = document.createElement("div");
      option.setAttribute("role", "option");
      option.textContent = choice;
      option.addEventListener("click", () => {
        wrapper.querySelector(".select__placeholder, .select__single-value")?.remove();
        const value = document.createElement("div");
        value.className = "select__single-value";
        value.textContent = choice;
        wrapper.querySelector(".select__control")?.prepend(value);
        input.value = "";
        close();
      });
      menu.append(option);
    }
    shell.append(menu);
  };
  // a list that is looked up as you type shows nothing until something is typed
  wrapper.querySelector(".select__control")?.addEventListener("mousedown", () => !options.lookedUp && open());
  input.addEventListener("input", () => (input.value ? open(input.value) : options.lookedUp ? close() : open()));
  input.addEventListener("keydown", (event) => (event as KeyboardEvent).key === "Escape" && close());
  return { input, picked: () => wrapper.querySelector(".select__single-value")?.textContent ?? "" };
}

// a yes and no question the way ashby builds one: two buttons that light up, with no form around them
function yesNo(question: string, required = true) {
  const entry = document.createElement("div");
  entry.className = "form-field-entry";
  entry.innerHTML = `<label class="question-title ${required ? "_required_x" : ""}">${question}</label><div class="yesno"><button aria-pressed="false">Yes</button><button aria-pressed="false">No</button><input type="checkbox" tabindex="-1"></div>`;
  document.body.append(entry);
  const buttons = [...entry.querySelectorAll("button")];
  for (const button of buttons) button.addEventListener("click", () => buttons.forEach((other) => other.setAttribute("aria-pressed", String(other === button))));
  return { pressed: () => buttons.find((button) => button.getAttribute("aria-pressed") === "true")?.textContent ?? "" };
}

describe("search boxes that open a list", () => {
  it("opens each one and clicks the matching choice, from the list or by typing", async () => {
    document.body.innerHTML = "";
    const authorized = searchBox("Are you legally authorized to work in the United States?", ["Yes", "No"], { required: true });
    const gender = searchBox("Gender", ["Male", "Female", "Decline To Self Identify"]);
    const country = searchBox("Country", ["Canada", "Mexico", "United States"], { required: true });
    const city = searchBox("Location (City)", ["Portland, Oregon, United States", "Portland, Maine, United States"], { required: true, lookedUp: true });
    const source = searchBox("How did you hear about this job?", ["Job board", "Employee referral"], { required: true });
    const reports = await fillDropdowns(document, { workAuthorization: "Yes", eeoGender: "Decline to self-identify", country: "United States", location: "Portland, Oregon", howHeard: "LinkedIn" }, false);
    expect([authorized.picked(), gender.picked(), country.picked()]).toEqual(["Yes", "Decline To Self Identify", "United States"]);
    // a place is found by typing it, and the site's own wording for it is taken
    expect(city.picked()).toBe("Portland, Oregon, United States");
    // no choice says LinkedIn: left empty for the person, with nothing typed left behind and its list closed
    expect(source.picked()).toBe("");
    expect(source.input.value).toBe("");
    expect(document.querySelector(".select__menu")).toBeNull();
    expect(reports.map((report) => [report.label, report.status, report.value])).toEqual([
      ["Are you legally authorized to work in the United States? *", "filled", "Yes"],
      ["Gender", "filled", "Decline To Self Identify"],
      ["Country *", "filled", "United States"],
      ["Location (City) *", "review", "Portland, Oregon, United States"],
      ["How did you hear about this job? *", "missing", ""],
    ]);
    // the plain field finder leaves these alone, so nothing is typed into one as if it were a text box
    expect(findFields(document, generic)).toEqual([]);
  });

  it("takes an answer the person gave later, and leaves one they already set alone", async () => {
    document.body.innerHTML = "";
    const source = searchBox("How did you hear about this job?", ["Job board", "Employee referral"], { required: true });
    const [first] = await fillDropdowns(document, {}, false);
    expect(first?.status).toBe("missing");
    const answered = await setDropdown(document, first?.id ?? "", "Employee referral", "howHeard", "filled");
    expect(source.picked()).toBe("Employee referral");
    expect(answered).toMatchObject({ status: "filled", value: "Employee referral" });
    expect((await fillDropdowns(document, { howHeard: "Job board" }, false))[0]).toMatchObject({ status: "filled", value: "Employee referral" });
  });
});

describe("yes and no buttons", () => {
  it("finds each pair, answers the ones the profile covers and lists the rest with their choices", async () => {
    document.body.innerHTML = "";
    const sponsor = yesNo("Will you now or in the future require visa sponsorship?");
    const tools = yesNo("Are you familiar with or open to using AI tools to assist with writing code?");
    const relocate = yesNo("Are you willing to relocate?", false);
    document.body.insertAdjacentHTML("beforeend", '<form><button type="submit">Yes</button><button type="submit">No</button></form><div><button>Yes</button><button>No</button><button>Maybe</button></div>');
    // a pair inside a form that would send it, and a group of three, are not yes and no questions
    expect(findYesNo(document)).toHaveLength(3);
    const reports = await fillDropdowns(document, { sponsorship: "No", relocation: "Yes" }, false);
    expect([sponsor.pressed(), tools.pressed(), relocate.pressed()]).toEqual(["No", "", "Yes"]);
    expect(reports.map((report) => [report.status, report.value, report.required, report.options])).toEqual([
      ["filled", "No", true, ["Yes", "No"]],
      ["missing", "", true, ["Yes", "No"]],
      ["filled", "Yes", false, ["Yes", "No"]],
    ]);
    await setDropdown(document, reports[1]?.id ?? "", "Yes", null, "filled");
    expect(tools.pressed()).toBe("Yes");
  });

  it("only lets a yes or no button through the click guard when it cannot send a form", () => {
    document.body.innerHTML = '<div><button id="a">Yes</button><button id="b">No</button></div><form><div><button id="c">Yes</button><button id="d">No</button></div><div><button id="e" type="button">Yes</button><button id="f" type="button">No</button></div></form><div><button id="g">Yes</button><button id="h">Submit</button></div><div><button id="i">Yes</button></div>';
    const risky = (id: string) => wouldSubmit(document.getElementById(id) as HTMLElement);
    expect(["a", "b", "e", "f"].map(risky)).toEqual([false, false, false, false]);
    // inside a form with no type, a button sends the form. and Submit is never an answer
    expect(["c", "d", "h", "i"].map(risky)).toEqual([true, true, true, true]);
    expect(pressAnswer(document.getElementById("h") as HTMLElement)).toBe(false);
  });
});

describe("reading fields off real kinds of markup", () => {
  it("does not mistake a whole question for a contact field", () => {
    document.body.innerHTML = `<form>
      <label for="a">Phone</label><input id="a" type="text">
      <label for="b">Have you contributed to a mobile app(s) and/or several features that reached a large number of users? Please describe.</label><input id="b" type="text" required>
      <label for="c">Has someone at Linear referred you for this role? If so, please include their name here:</label><input id="c" type="text">
      <label for="d">Name Pronunciation | How do you pronounce your name?</label><input id="d" type="text">
      <label for="e">Preferred First Name</label><input id="e" type="text">
      <label for="f">What country are you based in?</label><input id="f" type="text">
      <label for="g">Please share some details about your proudest project in 2 to 3 sentences.</label><input id="g" type="text" required>
    </form>`;
    expect(findFields(document, generic).map((field) => field.key)).toEqual(["phone", "question", "question", "question", "preferredName", "country", "question"]);
  });

  it("leaves a captcha's own box out, cuts status lines off a label, and names an upload for what goes in it", () => {
    document.body.innerHTML = `<form>
      <label>Current location <span>✱</span><span>No location found. Try entering a different location</span><span>Loading</span><input name="location" type="text"></label>
      <label>What is your location?<select name="place"><option>Select...</option><option>Afghanistan</option><option>Albania</option></select></label>
      <div class="application-question"><div class="application-label"><div class="text">Walk us through a project you designed.</div></div><div class="application-field"><div><div><textarea name="cards[x][field2]" required></textarea></div></div></div></div>
      <div id="resume_fieldset" data-field="resume"><button type="button">Attach</button><input type="file" id="resume"></div>
      <textarea id="g-recaptcha-response-1" name="g-recaptcha-response"></textarea><textarea name="h-captcha-response"></textarea>
    </form>`;
    const fields = findFields(document, generic);
    expect(fields.map((field) => [field.label, field.required])).toEqual([
      ["Current location ✱", true],
      ["What is your location?", false],
      ["Walk us through a project you designed.", true],
      ["Resume", false],
    ]);
  });
});

describe("kinds of captcha", () => {
  const kind = (html: string) => {
    document.body.innerHTML = html;
    return captchaKind(document);
  };
  const hiddenPuzzle = '<div style="visibility: hidden; position: absolute; top: -10000px"><div><iframe title="recaptcha challenge expires in two minutes" src="https://www.recaptcha.net/recaptcha/enterprise/bframe?hl=en"></iframe></div></div>';

  it("tells a check that runs out of sight from a box to tick or a puzzle", () => {
    expect(kind("<form><input name=email></form>")).toBe("none");
    // the kind the page runs by itself when the form is sent
    const background = `<div class="grecaptcha-badge"><iframe title="reCAPTCHA" src="https://www.recaptcha.net/recaptcha/enterprise/anchor?ar=1&k=abc&size=invisible&cb=1"></iframe></div>${hiddenPuzzle}`;
    expect(kind(background)).toBe("background");
    expect(hasCaptcha(document)).toBe(false);
    expect(kind('<div class="g-recaptcha" data-sitekey="x" data-size="invisible"></div>')).toBe("background");
    expect(kind('<div class="h-captcha" data-sitekey="x" data-size="invisible"></div>')).toBe("background");
    // a box to tick
    expect(kind('<div class="g-recaptcha" data-sitekey="x"></div>')).toBe("challenge");
    expect(kind('<iframe src="https://www.google.com/recaptcha/api2/anchor?ar=1&k=abc&size=normal"></iframe>')).toBe("challenge");
    expect(kind('<div id="h-captcha" class="h-captcha" data-sitekey="x"><iframe title="Widget containing checkbox for hCaptcha security challenge" src="https://newassets.hcaptcha.com/captcha/v1/x/static/hcaptcha.html#frame=checkbox"></iframe></div>')).toBe("challenge");
    expect(kind('<div class="cf-turnstile" data-sitekey="x"></div>')).toBe("challenge");
    // a kind we have not met is treated as one only the person can do
    expect(kind('<div data-sitekey="x"></div>')).toBe("challenge");
    expect(hasCaptcha(document)).toBe(true);
  });

  it("notices a puzzle that pops up after the form was sent", () => {
    const anchor = '<iframe src="https://www.recaptcha.net/recaptcha/enterprise/anchor?ar=1&k=abc&size=invisible"></iframe>';
    expect(kind(`${anchor}<div style="visibility: visible"><div><iframe style="height: 580px" src="https://www.recaptcha.net/recaptcha/enterprise/bframe?hl=en"></iframe></div></div>`)).not.toBe("none");
  });
});

describe("knowing an application went through", () => {
  const says = (text: string) => {
    document.body.innerHTML = `<main><h1>${text}</h1></main>`;
    return looksConfirmed(document);
  };
  it("reads the ways job sites say thanks", () => {
    for (const text of ["Thank you for applying.", "Thanks for applying!", "Your application was successfully submitted. We will contact you if there are next steps.", "Application submitted!", "Your application has been received", "We have received your application", "We got your application", "Thank you for your application", "You have successfully applied", "Your application is complete"]) expect(says(text), text).toBe(true);
  });
  it("does not take a form, or a promise about the future, for a thank you", () => {
    for (const text of ["Submit application", "Apply for this job", "Once your application is submitted we will review it", "Applications are received until May", "Thank you for your interest in Acme"]) expect(says(text), text).toBe(false);
  });
});

describe("the company in a tab title", () => {
  it("is read from the ways job sites title their pages", () => {
    expect(companyFromTitle("Software Engineer, iOS @ Ramp", "Software Engineer, iOS")).toBe("Ramp");
    expect(companyFromTitle("Job Application for Engineering Manager, Machine Learning (Safety) at Discord", "Engineering Manager, Machine Learning (Safety)")).toBe("Discord");
    expect(companyFromTitle("Palantir Technologies - American Tech Fellowship", "American Tech Fellowship")).toBe("Palantir Technologies");
    expect(companyFromTitle("Data Analyst - Northwind Health", "Data Analyst")).toBe("Northwind Health");
    // nothing to go on is nothing, not a guess
    expect(companyFromTitle("Careers", "Data Analyst")).toBe("");
    expect(companyFromTitle("Great place to work at scale", "")).toBe("");
  });
});
