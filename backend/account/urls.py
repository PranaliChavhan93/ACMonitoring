from django.urls import path

from .cloud_views import CloudCustomerListView, CloudUserListView

# from .views import (
#     AdminDetailView,
#     AdminListView,
#     BranchListView,
#     CircleListView,
#     CustomerDetailView,
#     CustomerListView,
#     EngDetailView,
#     EngListView,
#     FloorListView,
#     OrganizationListView,
#     SiteListView,
#     TalukaListView,
#     UserListView,
#     ZoneListView, StateListView, DistrictListView,
#     site_assignment,
#     ac_data,
#     branch_assignments,
#     branch_ownership,
#     dashboard_preference_detail,
#     dashboard_preferences,
#     unassigned_devices,
#     dashboard_summary_view,
#     device,
#     devices,
#     latest_ac_data,
#     location_detail,
#     locations,
#     login_view,
#     logout_view,
#     me_view,
#     ac_data_with_location,
#     telemetry_status,
#     LocationListView,
#     treands,
# )

from .views import (
    AdminDetailView,
    AdminListView,
    BranchListView,
    CircleListView,
    CustomerDetailView,
    CustomerListView,
    EngDetailView,
    EngListView,
    FloorListView,
    OrganizationListView,
    SiteListView,
    TalukaListView,
    UserListView,
    ZoneListView,
    StateListView,
    DistrictListView,
    DeviceCreateView,

    # SiteCreateView,
    # CustomerSiteMappingView,
    # SiteDeviceMappingView,
    # CustomerDeviceMappingView,

    assign_device_to_customer,
    assign_device_to_site,
    create_branch_or_floor,
    create_device,
    create_site,
    pincode_lookup,
    search_site_branches,

    site_assignment,
    ac_data,
    branch_assignments,
    branch_ownership,
    dashboard_preference_detail,
    dashboard_preferences,
    three_tp_sites,
    unassigned_devices,
    dashboard_summary_view,
    device,
    devices,
    latest_ac_data,
    location_detail,
    locations,
    login_view,
    logout_view,
    me_view,
    ac_data_with_location,
    telemetry_status,
    LocationListView,
    treands,
)


urlpatterns = [
    path( "ac-data/", ac_data),
    path( "ac-data/latest/", latest_ac_data),
    path( "ac-data/status/", telemetry_status),
    path( "ac-data/with-location/", ac_data_with_location ),

    path( "dashboard/summary/", dashboard_summary_view ),
    path( "dashboard/preferences/", dashboard_preferences ),
    path( "dashboard/preferences/<uuid:pk>/", dashboard_preference_detail ),

    path( "v1/filters/locations/", locations),
    path( "v1/filters/locations/<str:location_type>/<int:location_id>/", location_detail),
    
    path( "devices/", devices ),
    path( "devices/unassigned/", unassigned_devices ),

    path( "auth/login/", login_view, name="login" ),
    path( "auth/logout/", logout_view),
    path( "auth/me/", me_view),

    path( "organizations/", OrganizationListView.as_view() ),
    path( "customers/", CustomerListView.as_view()),
    path( "customers/<int:pk>/", CustomerDetailView.as_view()),
    path( "admins/", AdminListView.as_view()),
    path( "admins/<uuid:pk>/", AdminDetailView.as_view()),
    path( "engineers/", EngListView.as_view()),
    path( "engineer/<uuid:pk>/", EngDetailView.as_view()),

    path( "org/device/", device),
    path( "org/dashboard/trends/", treands),

    path( "zones/", ZoneListView.as_view()),
    path( "circles/", CircleListView.as_view()),

    path( "sites/<uuid:pk>/assignment/", site_assignment),

    # path("sites/create/", create_site),
    
    path( "states/", StateListView.as_view()),
    path( "districts/", DistrictListView.as_view()),
    path( "talukas/", TalukaListView.as_view()),

    path( "branches/", BranchListView.as_view()),
    path( "floors/", FloorListView.as_view()),
    path( "users/", UserListView.as_view()),

    path( "branches/assignments/", branch_assignments),
    path( "branches/ownership/", branch_ownership),

    path( "sites/", SiteListView.as_view()),
    path( "sites/create/", create_site),
    path( "branches/search/", search_site_branches, name="branch-search" ),
    path( "pincode/<str:pincode>/", pincode_lookup, name="pincode-lookup" ),

    path( "devices/", devices),
    path( "devices/create/", DeviceCreateView.as_view()),
    path( "devices/unassigned/", unassigned_devices),
    path( "devices/assign/customer/", assign_device_to_customer ),
    path( "devices/assign/site/", assign_device_to_site ),

    path( "locations/create/", create_branch_or_floor ),
    path( "cloud/sites/", three_tp_sites ),
    # path( "dashboard/"),
    # path( "locations/"),
    # path( "admins/"),
    # path( "engineers/"),
    # path( "reports/"),
    # path( "settings/"),
    
    path( "cloud/customers/", CloudCustomerListView.as_view()),
    path( "cloud/users/", CloudUserListView.as_view()),


]