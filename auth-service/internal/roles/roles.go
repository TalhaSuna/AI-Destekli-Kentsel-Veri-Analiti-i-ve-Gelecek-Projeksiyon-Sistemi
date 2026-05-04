package roles

const (
	RoleAdmin = "admin"
	RoleUser  = "user"

	PermViewMap      = "view_map"
	PermViewTraffic  = "view_traffic"
	PermViewDensity  = "view_density"
	PermViewSpeed    = "view_speed"
	PermCreateReport = "create_report"
	PermAdminPanel   = "admin_panel"
)

// Permissions her rolün sahip olduğu yetkileri tanımlar.
var Permissions = map[string][]string{
	RoleAdmin: {
		PermViewMap,
		PermViewTraffic,
		PermViewDensity,
		PermViewSpeed,
		PermCreateReport,
		PermAdminPanel,
	},
	RoleUser: {
		PermViewMap,
	},
}

// PermissionsFor verilen role ait yetki listesini döner.
func PermissionsFor(role string) []string {
	perms, ok := Permissions[role]
	if !ok {
		return []string{}
	}
	return perms
}
