
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** openscout-app
- **Date:** 2026-03-09
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001 Register a new account successfully and reach email confirmation page
- **Test Code:** [TC001_Register_a_new_account_successfully_and_reach_email_confirmation_page.py](./TC001_Register_a_new_account_successfully_and_reach_email_confirmation_page.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/12024d70-7416-4836-a2e9-5223c01fa277/a812975f-8257-47d7-9265-94ad7a0a2512
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002 Registration fails with empty email
- **Test Code:** [TC002_Registration_fails_with_empty_email.py](./TC002_Registration_fails_with_empty_email.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/12024d70-7416-4836-a2e9-5223c01fa277/fd3a5a11-269d-41ab-bc59-65b0dab1daa8
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003 Registration fails with empty password
- **Test Code:** [TC003_Registration_fails_with_empty_password.py](./TC003_Registration_fails_with_empty_password.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/12024d70-7416-4836-a2e9-5223c01fa277/ba205fbe-ae4e-44a2-a999-63f6e1f339ee
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004 Registration fails with invalid email format
- **Test Code:** [TC004_Registration_fails_with_invalid_email_format.py](./TC004_Registration_fails_with_invalid_email_format.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/12024d70-7416-4836-a2e9-5223c01fa277/4b8c1df7-82e5-45e8-bf27-d4436c78d6ea
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007 Complete onboarding with all required sections and reach dashboard
- **Test Code:** [TC007_Complete_onboarding_with_all_required_sections_and_reach_dashboard.py](./TC007_Complete_onboarding_with_all_required_sections_and_reach_dashboard.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/12024d70-7416-4836-a2e9-5223c01fa277/936cf697-5bdf-4bed-82ff-c4e53708258e
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008 Finish About section required fields and proceed to next step
- **Test Code:** [TC008_Finish_About_section_required_fields_and_proceed_to_next_step.py](./TC008_Finish_About_section_required_fields_and_proceed_to_next_step.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/12024d70-7416-4836-a2e9-5223c01fa277/eb5ac102-d194-4249-aa88-40c94c2013ac
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009 Add a work experience entry during onboarding
- **Test Code:** [TC009_Add_a_work_experience_entry_during_onboarding.py](./TC009_Add_a_work_experience_entry_during_onboarding.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- '+ Add Experience' control is not present or not functional on the onboarding Work Experience step; only the Education section with '+ Add Education' is visible.
- The add-work-experience form/modal did not appear after interacting with available onboarding controls.
- 'Work experience' text or entry UI is not present on the page and search/scroll did not locate any work-experience UI.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/12024d70-7416-4836-a2e9-5223c01fa277/17b22a29-11d9-4c39-bb97-ab325408696c
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC012 Submit onboarding with missing required fields shows validation and blocks completion
- **Test Code:** [TC012_Submit_onboarding_with_missing_required_fields_shows_validation_and_blocks_completion.py](./TC012_Submit_onboarding_with_missing_required_fields_shows_validation_and_blocks_completion.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Onboarding allowed progression when required fields (First Name and Location) were cleared and Next/Submit was clicked; no validation blocked submission.
- The text 'required' is not visible on the onboarding page after submitting with empty required fields.
- Multiple attempts to trigger or locate validation messages ('required') were made (clearing fields, clicking Next twice, searching the page) and none produced the expected validation message.
- The UI does not appear to enforce client-side required-field validation for the Personal Info step of onboarding.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/12024d70-7416-4836-a2e9-5223c01fa277/68389791-9aaf-4787-ae84-8c6a7069dc68
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC015 Dashboard shows core feature cards after successful login
- **Test Code:** [TC015_Dashboard_shows_core_feature_cards_after_successful_login.py](./TC015_Dashboard_shows_core_feature_cards_after_successful_login.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/12024d70-7416-4836-a2e9-5223c01fa277/49401066-f879-4fa1-88a7-581a7e232f37
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC016 Navigate from Dashboard to CV Analysis via card
- **Test Code:** [TC016_Navigate_from_Dashboard_to_CV_Analysis_via_card.py](./TC016_Navigate_from_Dashboard_to_CV_Analysis_via_card.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/12024d70-7416-4836-a2e9-5223c01fa277/6e436932-099d-4bbf-b0cc-d3d6993ead70
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC017 Navigate from Dashboard to Mock Interview via card
- **Test Code:** [TC017_Navigate_from_Dashboard_to_Mock_Interview_via_card.py](./TC017_Navigate_from_Dashboard_to_Mock_Interview_via_card.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/12024d70-7416-4836-a2e9-5223c01fa277/ecf68780-8405-49b2-acc3-6641f5ece120
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC019 Dashboard shows onboarding prompt for users with incomplete onboarding
- **Test Code:** [TC019_Dashboard_shows_onboarding_prompt_for_users_with_incomplete_onboarding.py](./TC019_Dashboard_shows_onboarding_prompt_for_users_with_incomplete_onboarding.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/12024d70-7416-4836-a2e9-5223c01fa277/0eba8e1c-60f5-4590-8651-3c87cfa734c1
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC020 Navigate from onboarding prompt to Onboarding page
- **Test Code:** [TC020_Navigate_from_onboarding_prompt_to_Onboarding_page.py](./TC020_Navigate_from_onboarding_prompt_to_Onboarding_page.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/12024d70-7416-4836-a2e9-5223c01fa277/6506974d-0017-4c9f-b88c-2d01eca35eff
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC021 Invalid credentials do not allow access to dashboard
- **Test Code:** [TC021_Invalid_credentials_do_not_allow_access_to_dashboard.py](./TC021_Invalid_credentials_do_not_allow_access_to_dashboard.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/12024d70-7416-4836-a2e9-5223c01fa277/639f9d7d-a93d-4e98-ae8f-37b446b0082b
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC024 Attempt to analyze without uploading a CV shows validation error
- **Test Code:** [TC024_Attempt_to_analyze_without_uploading_a_CV_shows_validation_error.py](./TC024_Attempt_to_analyze_without_uploading_a_CV_shows_validation_error.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/12024d70-7416-4836-a2e9-5223c01fa277/6c801c62-64b9-411d-890c-6768496aa5fd
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **86.67** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---