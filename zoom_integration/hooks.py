app_name = "zoom_integration"
app_title = "Zoom Integration"
app_publisher = "Sharif"
app_description = "Zoom Integration for Frappe"
app_email = "sharif@gmail.com"
app_license = "MIT"

# Required Fixture Tracking
fixtures = [
    {
        "dt": "Workflow",
        "filters": [["name", "in", ["Zoom Meeting Approval Workflow"]]]
    }
]

app_include_js = []
app_include_css = []
