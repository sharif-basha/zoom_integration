frappe.ui.form.on("Zoom Meeting", {

    refresh(frm) {

        frm.clear_custom_buttons();

        // =====================================================
        // FLAGS
        // =====================================================

        const is_admin =
            frappe.session.user === "Administrator" ||
            frappe.user.has_role("System Manager");

        const is_approved =
            frm.doc.workflow_state === "Approved";

        // =====================================================
        // AUTO CREATE ON APPROVAL
        // =====================================================

        if (
            is_approved &&
            !frm.doc.zoom_meeting_id &&
            !frm.zoom_creating
        ) {

            frm.zoom_creating = true;

            frappe.call({
                // FIXED: Mapped path directly to your whitelisted Python controller
                method: "zoom_integration.zoom_integration.doctype.zoom_meeting.zoom_meeting.create_zoom_meeting",
                args: {
                    doc_name: frm.doc.name
                },
                freeze: true,
                freeze_message: "Creating Zoom Meeting...",
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
        // FIELD VISIBILITY CONTROLSETS
        // =====================================================

        const employee_fields = [
            "meeting_time",
            "subject",
            "enable_recording",
            "meeting_type",
            "employees"
        ];

        const restricted_fields = [
            "join_url",
            "start_url",         // Match schema fields
            "zoom_meeting_id",   // FIXED: Unified layout fieldname match
            "invitation_text",
            "zoom_status"
        ];

        // =====================================================
        // BEFORE APPROVAL STATE
        // =====================================================

        if (!is_approved) {

            employee_fields.forEach(field => {
                frm.toggle_display(field, true);
                frm.set_df_property(field, "read_only", 0);
            });

            restricted_fields.forEach(field => {
                frm.toggle_display(field, false);
            });
        }

        // =====================================================
        // AFTER APPROVAL STATE
        // =====================================================

        else {

            frm.fields.forEach(f => {
                if (f.df.fieldname) {
                    frm.toggle_display(f.df.fieldname, true);
                    frm.set_df_property(
                        f.df.fieldname,
                        "read_only",
                        !is_admin ? 1 : 0
                    );
                }
            });
        }

        // =====================================================
        // BUTTON GROUP: JOIN ACTION
        // =====================================================

        if (frm.doc.join_url) {

            frm.add_custom_button(
                "Join Meeting",
                () => {
                    window.open(frm.doc.join_url, "_blank");
                },
                "Zoom"
            );
        }

        // =====================================================
        // BUTTON GROUP: UPDATE ACTION
        // =====================================================

        if (
            is_admin &&
            frm.doc.zoom_meeting_id &&
            frm.doc.zoom_status !== "Deleted"
        ) {

            frm.add_custom_button(
                "Update Zoom Meeting",
                async () => {
                    frappe.confirm(
                        "Update Zoom Meeting details over Cloud?",
                        async () => {
                            const r = await frappe.call({
                                // FIXED: Path maps directly to your controller python script
                                method: "zoom_integration.zoom_integration.doctype.zoom_meeting.zoom_meeting.update_zoom_meeting",
                                args: {
                                    doc_name: frm.doc.name
                                },
                                freeze: true,
                                freeze_message: "Updating Zoom Meeting..."
                            });

                            if (!r.exc) {
                                frappe.show_alert({
                                    message: "Meeting Updated",
                                    indicator: "green"
                                });
                                frm.reload_doc();
                            }
                        }
                    );
                },
                "Zoom"
            ).addClass("btn-warning");
        }

        // =====================================================
        // BUTTON GROUP: CANCEL ACTION
        // =====================================================

        if (
            is_admin &&
            frm.doc.zoom_meeting_id &&
            frm.doc.zoom_status === "Created"
        ) {

            frm.add_custom_button(
                "Cancel Meeting",
                async () => {
                    frappe.confirm(
                        "Cancel this meeting assignment?",
                        async () => {
                            const r = await frappe.call({
                                // FIXED: Path maps directly to your controller python script
                                method: "zoom_integration.zoom_integration.doctype.zoom_meeting.zoom_meeting.cancel_zoom_meeting",
                                args: {
                                    doc_name: frm.doc.name
                                },
                                freeze: true,
                                freeze_message: "Cancelling Meeting..."
                            });

                            if (!r.exc) {
                                frappe.show_alert({
                                    message: "Meeting Cancelled",
                                    indicator: "orange"
                                });
                                frm.reload_doc();
                            }
                        }
                    );
                },
                "Zoom"
            ).addClass("btn-secondary");
        }

        // =====================================================
        // BUTTON GROUP: DELETE ACTION
        // =====================================================

        if (
            is_admin &&
            frm.doc.zoom_meeting_id &&
            frm.doc.zoom_status !== "Deleted"
        ) {

            frm.add_custom_button(
                "Delete Zoom Meeting",
                async () => {
                    frappe.confirm(
                        "Delete Zoom Meeting permanently from the cloud?",
                        async () => {
                            const r = await frappe.call({
                                // FIXED: Path maps directly to your controller python script
                                method: "zoom_integration.zoom_integration.doctype.zoom_meeting.zoom_meeting.delete_zoom_meeting",
                                args: {
                                    doc_name: frm.doc.name
                                },
                                freeze: true,
                                freeze_message: "Deleting Zoom Meeting..."
                            });

                            if (!r.exc) {
                                frappe.show_alert({
                                    message: "Meeting Deleted",
                                    indicator: "red"
                                });
                                frm.reload_doc();
                            }
                        }
                    );
                },
                "Zoom"
            ).addClass("btn-danger");
        }

        // =====================================================
        // BUTTON GROUP: NOTIFY / DISPATCH OUT INVITATIONS
        // =====================================================

        if (frm.doc.zoom_meeting_id) {

            frm.add_custom_button(
                "Send Invitations",
                async () => {
                    const r = await frappe.call({
                        // FIXED: Path maps directly to your controller python script
                        method: "zoom_integration.zoom_integration.doctype.zoom_meeting.zoom_meeting.send_new_participant_invitations",
                        args: {
                            doc_name: frm.doc.name
                        },
                        freeze: true,
                        freeze_message: "Sending Invitations..."
                    });

                    if (!r.exc) {
                        frappe.show_alert({
                            message: r.message || "Invitations Sent",
                            indicator: "green"
                        });
                        frm.reload_doc();
                    }
                },
                "Zoom"
            );
        }
    }
});
