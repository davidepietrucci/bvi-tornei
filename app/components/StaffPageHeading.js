export default function StaffPageHeading({ title, description, actions }) {
  return <div className="staff-page-heading"><div><h1 className="staff-page-title">{title}</h1>{description && <p className="staff-page-description">{description}</p>}</div>{actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}</div>;
}
