frappe.ui.form.on("Zoom Meeting", {

    refresh(frm) {
        console.log("Current Workflow State:", frm.doc.workflow_state);
        console.log("Meeting ID:", frm.doc.zoom_meeting_id);
        console.log("Is Local:", frm.doc.__islocal);

        frm.clear_custom_buttons();

        const is_admin = frappe.session.user === "Administrator" || frappe.user.has_role("System Manager");
        const is_approved = frm.doc.workflow_state === "Approved";

        // =====================================================
        // AUTO CREATE (Removed strict __islocal block for initial save states)
        // =====================================================
        if (is_approved && !frm.doc.zoom_meeting_id && !frm.zoom_creating) {
            console.log("All conditions met! Triggering Zoom API Call...");
            frm.zoom_creating = true;

            frappe.call({
                method: "zoom_integration.zoom_integration.doctype.zoom_meeting.zoom_meeting.create_zoom_meeting",
                args: {
                    docname: frm.doc.name
                },
                freeze: true,
                freeze_message: "Creating Zoom Meeting via API...",
                callback(r) {
                    frm.zoom_creating = false;
                    if (!r.exc) {
                        frappe.show_alert({
                            message: "Zoom Meeting Created",
                            indicator: "green"
                        });
                        frm.reload_doc();
                    }
                }
            });
            return;
        }

        // =====================================================
        // FIELD VISIBILITY
        // =====================================================
        const employee_fields = ["meeting_time", "subject", "enable_recording", "meeting_type", "employees"];
        const restricted_fields = ["join_url", "zoom_meeting_id", "start_url", "invitation_text", "zoom_status"];

        if (!is_approved) {
            employee_fields.forEach(field => {
                frm.toggle_display(field, true);
                frm.set_df_property(field, "read_only", 0);
            });
            restricted_fields.forEach(field => {
                frm.toggle_display(field, false);
            });
        } else {
            frm.fields.forEach(f => {
                if (f.df.fieldname) {
                    frm.toggle_display(f.df.fieldname, true);
                    frm.set_df_property(f.df.fieldname, "read_only", !is_admin ? 1 : 0);
                }
            });
        }

        // =====================================================
        // JOIN BUTTON
        // =====================================================
        if (frm.doc.join_url) {
            frm.add_custom_button("Join Meeting", () => {
                window.open(frm.doc.join_url, "_blank");
            }, "Zoom");
        }
    }
});
