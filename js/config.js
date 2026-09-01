/* ==========================================================================
   PIHUB Dashboard — Configuration
   ========================================================================== */

const CONFIG = {
  API_BASE_URL: 'https://pihub-backend.onrender.com',
// API_BASE_URL: 'http://127.0.0.1:8000',

  ENDPOINTS: {
    // Auth
    LOGIN: '/api/accounts/login/',
    CREATE_STAFF: '/api/accounts/create-staff/',
    CHANGE_PASSWORD: '/api/accounts/change-password/',

    // Workspaces
    WORKSPACE_PLANS: '/api/workspaces/plans/',
    BOOKINGS: '/api/workspaces/bookings/',
    WORKSPACE_TAGS: '/api/workspaces/tags/',

    // Courses
    COURSES: '/api/courses/',
    STUDENTS: '/api/courses/students/',

    // Certificates
    CERTIFICATES: '/api/certificates/',
    CERTIFICATE_VERIFY: '/api/certificates/verify/',

    // Blog
    BLOG_POSTS_PUBLIC: '/api/blog/posts/',
    BLOG_POSTS_STAFF: '/api/blog/staff/posts/',
    BLOG_CATEGORIES_STAFF: '/api/blog/staff/categories/',

    // Gallery & Enquiries
    GALLERY_PUBLIC: '/api/core/gallery/',
    GALLERY_STAFF: '/api/core/staff/gallery/',
    ENQUIRIES_PUBLIC: '/api/core/enquiries/',
    ENQUIRIES_STAFF: '/api/core/staff/enquiries/',

    // Newsletter — confirmed base path (registered via router in core/urls.py)
    SUBSCRIBE: '/api/core/subscribe/',
    UNSUBSCRIBE: '/api/core/unsubscribe/', // + <uuid:token>/
    NEWSLETTERS: '/api/core/newsletters/', // "send" sub-route still unconfirmed — need views.py
    SUBSCRIBERS: '/api/core/staff/subscribers/', // staff-only, confirmed via router in core/urls.py

    // Payments — staff list endpoint not yet built on backend
    PAYMENT_WEBHOOK: '/api/payments/webhook/paystack/',
  },

  STORAGE_KEYS: {
    TOKEN: 'pihub_token',
    USER: 'pihub_user',
  },

  PAGE_SIZE: 10,
};