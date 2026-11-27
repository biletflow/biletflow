import 'package:flutter/foundation.dart';

import '../core/format.dart';

import 'package:material_ui/material_ui.dart';

class AppLocalizations {
  final Locale locale;
  AppLocalizations(this.locale);

  static const supportedLocales = [Locale('en'), Locale('ru'), Locale('kk')];

  static AppLocalizations of(BuildContext context) {
    final value = Localizations.of<AppLocalizations>(context, AppLocalizations);
    assert(value != null, 'AppLocalizations missing');
    return value!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  static const _catalogLabels = <String, Map<String, String>>{
    'en': {
      'Almaty': 'Almaty',
      'Astana': 'Astana',
      'Shymkent': 'Shymkent',
      'Music': 'Music',
      'Community': 'Community',
      'Technology': 'Technology',
      'Film': 'Film',
      'Business': 'Business',
      'Education': 'Education',
      'General Admission': 'General Admission',
      'VIP': 'VIP',
      'Free Entry': 'Free Entry',
      'Standard': 'Standard',
      'Student': 'Student',
      'Seat': 'Seat',
      'Early Bird': 'Early Bird',
    },
    'ru': {
      'Almaty': 'Алматы',
      'Astana': 'Астана',
      'Shymkent': 'Шымкент',
      'Music': 'Музыка',
      'Community': 'Сообщество',
      'Technology': 'Технологии',
      'Film': 'Кино',
      'Business': 'Бизнес',
      'Education': 'Образование',
      'General Admission': 'Общий вход',
      'VIP': 'VIP',
      'Free Entry': 'Бесплатный вход',
      'Standard': 'Стандарт',
      'Student': 'Студенческий',
      'Seat': 'Место',
      'Early Bird': 'Ранняя цена',
    },
    'kk': {
      'Almaty': 'Алматы',
      'Astana': 'Астана',
      'Shymkent': 'Шымкент',
      'Music': 'Музыка',
      'Community': 'Қауымдастық',
      'Technology': 'Технология',
      'Film': 'Кино',
      'Business': 'Бизнес',
      'Education': 'Білім',
      'General Admission': 'Жалпы кіру',
      'VIP': 'VIP',
      'Free Entry': 'Тегін кіру',
      'Standard': 'Стандарт',
      'Student': 'Студенттік',
      'Seat': 'Орын',
      'Early Bird': 'Ерте баға',
    },
  };

  String cityName(String value) =>
      _catalogLabels[locale.languageCode]?[value] ?? value;
  String categoryName(String value) =>
      _catalogLabels[locale.languageCode]?[value] ?? value;
  String ticketTypeName(String value) =>
      _catalogLabels[locale.languageCode]?[value] ?? value;

  static const _tables = <String, Map<String, String>>{
    'en': {
      'scannerTitle': 'QR scanner',
      'loadScanEvents': 'Load available events',
      'noScanEvents': 'No events are available for scanning.',
      'selectScanEvent': 'Select an event',
      'stopCamera': 'Stop camera',
      'refreshAttendance': 'Refresh attendance',
      'attendeeSearch': 'Name, email or order reference',
      'searchAttendees': 'Search attendees',
      'noMatchingAttendees': 'No matching attendees',
      'reverse': 'Reverse',
      'reverseQuestion': 'Reverse check-in?',
      'reverseCheckIn': 'Reverse check-in',
      'reason': 'Reason',
      'cancel': 'Cancel',
      'threeCharacters': 'Enter at least 3 characters.',
      'checkInReversed': 'Check-in reversed',
      'cameraStopFailed': 'Could not stop the camera.',
      'cameraOpenFailed': 'Could not open the camera. Retry.',
      'cameraInUse':
          'Could not open the camera. Close other camera apps and retry.',
      'cameraDenied': 'Camera access is denied. Allow BiletFlow to use the camera in your phone settings, then retry.',
      'scanAccessChanged': 'Access changed. Reload your available events.',
      'scanUnavailable': 'This event or check-in is no longer available.',
      'scanChanged': 'This check-in has already changed. Search again.',
      'scanRateLimited': 'Too many requests. Wait a moment and retry.',
      'scanServerError': 'The server could not complete the request. Retry.',
      'scanTimeout': 'Request timed out. Check the connection and retry.',
      'scanRequestFailed':
          'Could not complete the request. Check the connection and retry.',
      'admitted': 'Admission confirmed',
      'alreadyAdmitted': 'Ticket already used',
      'wrongEvent': 'Ticket for another event',
      'notATicket': 'This QR code is not a ticket',
      'invalidTicket': 'Invalid ticket code',
      'checkedInLabel': 'Checked in',
      'support': 'Support',
      'newRequest': 'New request',
      'noSupportRequests': 'No support requests',
      'refundRequest': 'Refund request',
      'newSupportRequest': 'New support request',
      'subject': 'Subject',
      'message': 'Message',
      'sending': 'Sending…',
      'sendRequest': 'Send request',
      'supportConversation': 'Support conversation',
      'reply': 'Reply',
      'sendReply': 'Send reply',
      'askRefund': 'Ask about a refund',
      'supportOpen': 'Open',
      'supportInProgress': 'In progress',
      'supportWaiting': 'Waiting for customer',
      'supportResolved': 'Resolved',
      'appName': 'BiletFlow',
      'language': 'Language',
      'signOut': 'Sign out',
      'welcome': 'Welcome, {name}',
      'account': 'Account',
      'browseEvents': 'Browse events',
      'browseEventsSubtitle': 'Search and open event details',
      'myTickets': 'My tickets',
      'myTicketsSubtitle': 'QR and printable PDF',
      'myEvents': 'My events',
      'allEventStatuses': 'All',
      'eventDraft': 'Draft',
      'eventPublished': 'Published',
      'eventCancelled': 'Cancelled',
      'eventCompleted': 'Completed',
      'eventDetails': 'Event details',
      'ticketTypes': 'Ticket types',
      'ticketInventory': '{sold} sold · {available} available',
      'scanTicket': 'Scan ticket',
      'email': 'Email',
      'password': 'Password',
      'signIn': 'Sign in',
      'signingIn': 'Signing in…',
      'emailRequired': 'Enter an email address',
      'passwordRequired': 'Enter a password',
      'searchEvents': 'Search events, venues…',
      'search': 'Search',
      'city': 'City',
      'allCities': 'All cities',
      'category': 'Category',
      'visibility': 'Visibility',
      'preview': 'Preview',
      'allCategories': 'All categories',
      'price': 'Price',
      'anyPrice': 'Any price',
      'free': 'Free',
      'under10k': 'Under ₸10,000',
      'over10k': '₸10,000+',
      'noEvents': 'No events found',
      'soldOut': 'Sold out',
      'fromPrice': 'from ₸{amount}',
      'tickets': 'Tickets',
      'noTicketTypes': 'No ticket types available',
      'left': '{count} left',
      'organizer': 'Organizer: {name}',
      'continueWithTickets': 'Continue with {count} ticket(s)',
      'selectTickets': 'Select tickets',
      'checkout': 'Checkout',
      'fullName': 'Full name',
      'promoCode': 'Promo code',
      'apply': 'Apply',
      'promoApplied': 'Promo applied',
      'discount': 'Discount: −₸{amount}',
      'total': 'Total: {amount}',
      'placeOrder': 'Place order',
      'working': 'Working…',
      'order': 'Order',
      'refresh': 'Refresh',
      'status': 'Status: {status}',
      'totalLabel': 'Total: {amount}',
      'simulatedPayment': 'Test payment. No real funds will be charged.',
      'approvePayment': 'Approve payment',
      'decline': 'Decline',
      'abandon': 'Abandon',
      'cancelReservation': 'Cancel reservation',
      'refundOrder': 'Refund order',
      'refundConfirmation': 'All tickets in this order will be invalidated. Continue with the refund?',
      'paymentSucceeded': 'Your tickets are ready.',
      'holdExpired': 'Checkout hold expired. No ticket was issued.',
      'orderClosed': 'Order closed without tickets.',
      'noTickets': 'No tickets yet',
      'admissionQr': 'Admission QR',
      'qrUnavailable': 'QR is unavailable for this ticket status.',
      'ticketInvalid': 'This ticket is not valid for entry.',
      'sharePdf': 'Share / save PDF',
      'preparingPdf': 'Preparing PDF…',
      'pdfFailed': 'Unable to open PDF',
      'qrNote': 'Show this QR code at the entrance.',
      'ticketStatusValid': 'Valid',
      'ticketStatusCheckedIn': 'Checked in',
      'ticketStatusCancelled': 'Cancelled',
      'ticketStatusRefunded': 'Refunded',
      'errorGeneric': 'Could not complete that request. Try again.',
      'errorValidation': 'Check the details and try again.',
      'errorConflict': 'Those tickets are no longer available.',
      'errorHoldExpired': 'Your checkout hold expired. Start again.',
      'errorPromo': 'That promo code is not valid for this order.',
      'errorInvalid': 'Email or password is incorrect.',
      'errorForbidden': 'This account is suspended.',
      'errorNotFound': 'Not found',
      'createAccount': 'Create account',
      'name': 'Name',
      'nameRequired': 'Enter your name',
      'passwordHint': 'At least 10 characters',
      'registering': 'Creating account…',
      'forgotPassword': 'Forgot password?',
      'forgotLead': 'We will email a reset link if this account exists.',
      'sendReset': 'Send reset link',
      'sendingReset': 'Sending…',
      'resetSent':
          'If an account exists for that email, a reset link is on its way.',
      'resetPassword': 'Choose a new password',
      'verifyEmail': 'Verify email',
      'verificationLead': 'Paste the verification link from your email.',
      'resendVerification': 'Resend verification email',
      'verificationSent': 'A verification email is on its way.',
      'invalidEmailLink': 'Enter a valid link or token from your email.',
      'resetLead':
          'Paste the reset link from your email and choose a new password.',
      'resetToken': 'Reset link or token',
      'newPassword': 'New password',
      'savePassword': 'Save password',
      'savingPassword': 'Saving…',
      'backToSignIn': 'Back to sign in',
      'createEvent': 'Create event',
      'editEvent': 'Edit event',
      'addTicketType': 'Add ticket type',
      'editTicketType': 'Edit ticket type',
      'deleteTicketType': 'Delete ticket type',
      'deleteTicketTypeTitle': 'Delete ticket type?',
      'deleteTicketTypeBody': 'Only ticket types without issued tickets or reservations can be deleted.',
      'back': 'Back',
      'delete': 'Delete',
      'hideTicketType': 'This ticket type has tickets or reservations. Hide it from sales instead.',
      'cancelEvent': 'Cancel event',
      'cancelReason': 'Reason for cancellation',
      'publish': 'Publish',
      'unpublish': 'Unpublish',
      'duplicate': 'Duplicate',
      'attendanceAndCampaigns': 'Attendance and campaigns',
      'eventTitle': 'Event title',
      'description': 'Description',
      'startsAt': 'Starts at (ISO date and time)',
      'endsAt': 'Ends at (ISO date and time)',
      'capacity': 'Capacity',
      'ticketName': 'Ticket name',
      'priceKzt': 'Price in KZT',
      'quantity': 'Quantity',
      'maxPerOrder': 'Maximum per order',
      'requiredField': 'Required',
      'wholeNumber': 'Enter a whole number',
      'isoDate': 'Enter a date and time in ISO format',
      'save': 'Save',
      'saving': 'Saving…',
      'eventReports': 'Event reports',
      'attendance': 'Attendance',
      'checkedInCount': '{checkedIn} / {registered} checked in',
      'campaigns': 'Campaigns',
      'noCampaigns': 'No campaigns',
      'campaignSubtitle': '{status} · {count} redemptions',
      'redemptions': 'Redemptions',
      'editCampaign': 'Edit campaign',
      'campaignName': 'Campaign name',
      'campaignQr': 'Campaign QR',
      'paidOrders': 'Paid orders',
      'reportTickets': 'Tickets',
      'grossSales': 'Gross sales',
      'discounts': 'Discounts',
      'netSales': 'Net sales',
      'active': 'Active',
      'paidSalesReviews': 'Paid-sales reviews',
      'noPendingReviews': 'No pending reviews',
      'approveReviewTitle': 'Approve paid-sales review?',
      'rejectReviewTitle': 'Reject paid-sales review?',
      'approveReviewBody':
          "This records approval for the organizer's identity review.",
      'rejectReviewBody':
          'This records rejection and disables paid sales for the event.',
      'approve': 'Approve',
      'reject': 'Reject',
      'feePaid': 'Fee paid',
      'feePending': 'Fee pending',
      'payoutConnected': 'Payout account connected',
      'payoutPending': 'Payout account pending',
      'retry': 'Retry',
      'decrease': 'Decrease',
      'increase': 'Increase',
      'promoOrCampaign': 'Promo code or campaign link',
      'campaignApplied': 'Campaign applied',
      'hidden': 'Hidden',
      'errorAuth': 'Sign in again',
      'discover': 'Discover',
      'welcomeBack': 'Welcome back',
      'heroTitle': 'Your next great event',
      'heroAccent': 'starts here',
      'upcoming': 'Upcoming events',
      'workspace': 'Workspace',
      'orderHistory': 'Order history',
      'noOrders': 'No orders yet',
      'registrationUnavailable': 'Registration is closed.',
      'paidSalesUnavailable':
          'Paid sales are currently unavailable for this event.',
      'paid': 'Confirmed',
      'awaiting': 'Awaiting payment',
      'expired': 'Expired',
      'failed': 'Payment failed',
      'unknown': 'Unavailable',
      'rate': 'Too many attempts. Wait a moment and try again.',
      'simRefund': 'This is a test refund. Your tickets will become invalid.',
      'testOrder': 'Test transaction',
      'verified': 'Email verified',
    },
    'ru': {
      'scannerTitle': 'QR-сканер',
      'loadScanEvents': 'Загрузить доступные события',
      'noScanEvents': 'Нет событий для сканирования.',
      'selectScanEvent': 'Выберите событие',
      'stopCamera': 'Выключить камеру',
      'refreshAttendance': 'Обновить посещаемость',
      'attendeeSearch': 'Имя, email или номер заказа',
      'searchAttendees': 'Найти участников',
      'noMatchingAttendees': 'Участники не найдены',
      'reverse': 'Отменить',
      'reverseQuestion': 'Отменить регистрацию прохода?',
      'reverseCheckIn': 'Отменить регистрацию прохода',
      'reason': 'Причина',
      'cancel': 'Отмена',
      'threeCharacters': 'Введите не менее 3 символов.',
      'checkInReversed': 'Регистрация прохода отменена',
      'cameraStopFailed': 'Не удалось выключить камеру.',
      'cameraOpenFailed': 'Не удалось открыть камеру. Повторите попытку.',
      'cameraInUse': 'Не удалось открыть камеру. Закройте другие приложения с камерой и повторите попытку.',
      'cameraDenied': 'Доступ к камере запрещён. Разрешите BiletFlow доступ в настройках телефона и повторите попытку.',
      'scanAccessChanged': 'Доступ изменился. Обновите список событий.',
      'scanUnavailable': 'Событие или отметка о проходе больше недоступны.',
      'scanChanged': 'Отметка о проходе изменилась. Повторите поиск.',
      'scanRateLimited':
          'Слишком много запросов. Подождите и повторите попытку.',
      'scanServerError': 'Сервер не смог выполнить запрос. Повторите попытку.',
      'scanTimeout':
          'Время ожидания истекло. Проверьте связь и повторите попытку.',
      'scanRequestFailed':
          'Не удалось выполнить запрос. Проверьте связь и повторите попытку.',
      'admitted': 'Проход подтверждён',
      'alreadyAdmitted': 'Билет уже использован',
      'wrongEvent': 'Билет на другое событие',
      'notATicket': 'Этот QR-код не является билетом',
      'invalidTicket': 'Недействительный код билета',
      'checkedInLabel': 'Прошли',
      'support': 'Поддержка',
      'newRequest': 'Новое обращение',
      'noSupportRequests': 'Нет обращений',
      'refundRequest': 'Запрос на возврат',
      'newSupportRequest': 'Новое обращение в поддержку',
      'subject': 'Тема',
      'message': 'Сообщение',
      'sending': 'Отправляем…',
      'sendRequest': 'Отправить обращение',
      'supportConversation': 'Переписка с поддержкой',
      'reply': 'Ответ',
      'sendReply': 'Отправить ответ',
      'askRefund': 'Спросить о возврате',
      'supportOpen': 'Открыто',
      'supportInProgress': 'В работе',
      'supportWaiting': 'Ожидает ответа клиента',
      'supportResolved': 'Решено',
      'appName': 'BiletFlow',
      'language': 'Язык',
      'signOut': 'Выйти',
      'welcome': 'Здравствуйте, {name}',
      'account': 'Аккаунт',
      'browseEvents': 'Мероприятия',
      'browseEventsSubtitle': 'Поиск и карточка события',
      'myTickets': 'Мои билеты',
      'myTicketsSubtitle': 'QR и PDF для печати',
      'myEvents': 'Мои события',
      'allEventStatuses': 'Все',
      'eventDraft': 'Черновик',
      'eventPublished': 'Опубликовано',
      'eventCancelled': 'Отменено',
      'eventCompleted': 'Завершено',
      'eventDetails': 'Детали события',
      'ticketTypes': 'Типы билетов',
      'ticketInventory': 'Продано: {sold} · Доступно: {available}',
      'scanTicket': 'Сканировать билет',
      'email': 'Email',
      'password': 'Пароль',
      'signIn': 'Войти',
      'signingIn': 'Входим…',
      'emailRequired': 'Введите email',
      'passwordRequired': 'Введите пароль',
      'searchEvents': 'Поиск событий, площадок…',
      'search': 'Найти',
      'city': 'Город',
      'allCities': 'Все города',
      'category': 'Категория',
      'visibility': 'Видимость',
      'preview': 'Предпросмотр',
      'allCategories': 'Все категории',
      'price': 'Цена',
      'anyPrice': 'Любая цена',
      'free': 'Бесплатно',
      'under10k': 'До ₸10 000',
      'over10k': '₸10 000+',
      'noEvents': 'События не найдены',
      'soldOut': 'Распродано',
      'fromPrice': 'от ₸{amount}',
      'tickets': 'Билеты',
      'noTicketTypes': 'Типы билетов недоступны',
      'left': 'осталось {count}',
      'organizer': 'Организатор: {name}',
      'continueWithTickets': 'Продолжить с {count} билет(ами)',
      'selectTickets': 'Выберите билеты',
      'checkout': 'Оформление',
      'fullName': 'Имя',
      'promoCode': 'Промокод',
      'apply': 'Применить',
      'promoApplied': 'Промокод применён',
      'discount': 'Скидка: −₸{amount}',
      'total': 'Итого: {amount}',
      'placeOrder': 'Оформить заказ',
      'working': 'Отправляем…',
      'order': 'Заказ',
      'refresh': 'Обновить',
      'status': 'Статус: {status}',
      'totalLabel': 'Итого: {amount}',
      'simulatedPayment':
          'Тестовая оплата. Реальные средства не будут списаны.',
      'approvePayment': 'Одобрить оплату',
      'decline': 'Отклонить',
      'abandon': 'Отменить',
      'cancelReservation': 'Отменить бронь',
      'refundOrder': 'Вернуть заказ',
      'refundConfirmation':
          'Все билеты в заказе станут недействительными. Продолжить возврат?',
      'paymentSucceeded': 'Ваши билеты готовы.',
      'holdExpired': 'Время брони истекло. Билет не выдан.',
      'orderClosed': 'Заказ закрыт без билетов.',
      'noTickets': 'У вас пока нет билетов',
      'admissionQr': 'Входной QR',
      'qrUnavailable': 'QR недоступен для этого статуса билета.',
      'ticketInvalid': 'Этот билет не действует для входа.',
      'sharePdf': 'Поделиться / сохранить PDF',
      'preparingPdf': 'Готовим PDF…',
      'pdfFailed': 'Не удалось открыть PDF',
      'qrNote': 'Покажите этот QR-код на входе.',
      'ticketStatusValid': 'Действителен',
      'ticketStatusCheckedIn': 'Проверен',
      'ticketStatusCancelled': 'Отменён',
      'ticketStatusRefunded': 'Возвращён',
      'errorGeneric': 'Не получилось выполнить запрос. Попробуйте снова.',
      'errorValidation': 'Проверьте данные и попробуйте снова.',
      'errorConflict': 'Эти билеты уже недоступны.',
      'errorHoldExpired': 'Время брони истекло. Начните заново.',
      'errorPromo': 'Этот промокод не подходит для заказа.',
      'errorInvalid': 'Неверный email или пароль.',
      'errorForbidden': 'Этот аккаунт заблокирован.',
      'errorNotFound': 'Не найдено',
      'createAccount': 'Создать аккаунт',
      'name': 'Имя',
      'nameRequired': 'Введите имя',
      'passwordHint': 'Не менее 10 символов',
      'registering': 'Создаём аккаунт…',
      'forgotPassword': 'Забыли пароль?',
      'forgotLead': 'Если такой аккаунт есть, мы отправим ссылку для сброса.',
      'sendReset': 'Отправить ссылку',
      'sendingReset': 'Отправляем…',
      'resetSent':
          'Если аккаунт с этим email есть, ссылка для сброса уже отправлена.',
      'resetPassword': 'Новый пароль',
      'verifyEmail': 'Подтвердить email',
      'verificationLead': 'Вставьте ссылку для подтверждения из письма.',
      'resendVerification': 'Отправить письмо повторно',
      'verificationSent': 'Письмо для подтверждения отправлено.',
      'invalidEmailLink': 'Введите действительную ссылку или токен из письма.',
      'resetLead': 'Вставьте ссылку из письма и задайте новый пароль.',
      'resetToken': 'Ссылка или токен сброса',
      'newPassword': 'Новый пароль',
      'savePassword': 'Сохранить пароль',
      'savingPassword': 'Сохраняем…',
      'backToSignIn': 'Ко входу',
      'createEvent': 'Создать событие',
      'editEvent': 'Изменить событие',
      'addTicketType': 'Добавить тип билета',
      'editTicketType': 'Изменить тип билета',
      'deleteTicketType': 'Удалить тип билета',
      'deleteTicketTypeTitle': 'Удалить тип билета?',
      'deleteTicketTypeBody':
          'Удалить можно только тип без выданных билетов и броней.',
      'back': 'Назад',
      'delete': 'Удалить',
      'hideTicketType':
          'У этого типа есть билеты или брони. Скройте его из продажи.',
      'cancelEvent': 'Отменить событие',
      'cancelReason': 'Причина отмены',
      'publish': 'Опубликовать',
      'unpublish': 'Снять с публикации',
      'duplicate': 'Дублировать',
      'attendanceAndCampaigns': 'Посещаемость и кампании',
      'eventTitle': 'Название события',
      'description': 'Описание',
      'startsAt': 'Начало (дата и время ISO)',
      'endsAt': 'Окончание (дата и время ISO)',
      'capacity': 'Вместимость',
      'ticketName': 'Название билета',
      'priceKzt': 'Цена в тенге',
      'quantity': 'Количество',
      'maxPerOrder': 'Максимум в заказе',
      'requiredField': 'Обязательное поле',
      'wholeNumber': 'Введите целое число',
      'isoDate': 'Введите дату и время в формате ISO',
      'save': 'Сохранить',
      'saving': 'Сохраняем…',
      'eventReports': 'Отчёты события',
      'attendance': 'Посещаемость',
      'checkedInCount': 'Прошли: {checkedIn} / {registered}',
      'campaigns': 'Кампании',
      'noCampaigns': 'Кампаний нет',
      'campaignSubtitle': '{status} · погашений: {count}',
      'redemptions': 'Погашения',
      'editCampaign': 'Изменить кампанию',
      'campaignName': 'Название кампании',
      'campaignQr': 'QR кампании',
      'paidOrders': 'Оплаченные заказы',
      'reportTickets': 'Билеты',
      'grossSales': 'Валовые продажи',
      'discounts': 'Скидки',
      'netSales': 'Чистые продажи',
      'active': 'Активна',
      'paidSalesReviews': 'Проверка платных продаж',
      'noPendingReviews': 'Нет заявок на проверку',
      'approveReviewTitle': 'Одобрить проверку платных продаж?',
      'rejectReviewTitle': 'Отклонить проверку платных продаж?',
      'approveReviewBody':
          'Это фиксирует одобрение проверки личности организатора.',
      'rejectReviewBody':
          'Это фиксирует отказ и отключает платные продажи события.',
      'approve': 'Одобрить',
      'reject': 'Отклонить',
      'feePaid': 'Сбор оплачен',
      'feePending': 'Сбор не оплачен',
      'payoutConnected': 'Счёт для выплат подключён',
      'payoutPending': 'Счёт для выплат не подключён',
      'retry': 'Повторить',
      'decrease': 'Уменьшить',
      'increase': 'Увеличить',
      'promoOrCampaign': 'Промокод или ссылка кампании',
      'campaignApplied': 'Кампания применена',
      'hidden': 'Скрыт',
      'errorAuth': 'Войдите снова',
      'discover': 'События',
      'welcomeBack': 'С возвращением',
      'heroTitle': 'Ваше следующее событие',
      'heroAccent': 'начинается здесь',
      'upcoming': 'Ближайшие события',
      'workspace': 'Управление',
      'orderHistory': 'История заказов',
      'noOrders': 'Заказов пока нет',
      'registrationUnavailable': 'Регистрация закрыта.',
      'paidSalesUnavailable':
          'Платные продажи для этого мероприятия сейчас недоступны.',
      'paid': 'Подтверждён',
      'awaiting': 'Ожидает оплаты',
      'expired': 'Срок истёк',
      'failed': 'Оплата не прошла',
      'unknown': 'Недоступно',
      'rate': 'Слишком много попыток. Подождите и попробуйте снова.',
      'simRefund':
          'Это тестовый возврат. Ваши билеты станут недействительными.',
      'testOrder': 'Тестовая операция',
      'verified': 'Почта подтверждена',
    },
    'kk': {
      'scannerTitle': 'QR сканері',
      'loadScanEvents': 'Қолжетімді іс-шараларды жүктеу',
      'noScanEvents': 'Сканерлеуге қолжетімді іс-шаралар жоқ.',
      'selectScanEvent': 'Іс-шараны таңдаңыз',
      'stopCamera': 'Камераны өшіру',
      'refreshAttendance': 'Қатысу деректерін жаңарту',
      'attendeeSearch': 'Аты, электрондық пошта немесе тапсырыс нөмірі',
      'searchAttendees': 'Қатысушыларды іздеу',
      'noMatchingAttendees': 'Қатысушылар табылмады',
      'reverse': 'Болдырмау',
      'reverseQuestion': 'Кіру тіркеуін болдырмау керек пе?',
      'reverseCheckIn': 'Кіру тіркеуін болдырмау',
      'reason': 'Себеп',
      'cancel': 'Бас тарту',
      'threeCharacters': 'Кемінде 3 таңба енгізіңіз.',
      'checkInReversed': 'Кіру тіркеуі болдырылмады',
      'cameraStopFailed': 'Камераны өшіру мүмкін болмады.',
      'cameraOpenFailed': 'Камераны ашу мүмкін болмады. Қайталап көріңіз.',
      'cameraInUse': 'Камераны ашу мүмкін болмады. Камераны пайдаланатын басқа қолданбаларды жауып, қайталап көріңіз.',
      'cameraDenied': 'Камераға рұқсат берілмеген. Телефон баптауларында BiletFlow қолданбасына рұқсат беріп, қайталап көріңіз.',
      'scanAccessChanged': 'Рұқсат өзгерді. Іс-шаралар тізімін жаңартыңыз.',
      'scanUnavailable': 'Іс-шара немесе кіру жазбасы енді қолжетімді емес.',
      'scanChanged': 'Кіру жазбасы өзгерді. Қайта іздеңіз.',
      'scanRateLimited': 'Сұраулар тым көп. Біраз күтіп, қайталап көріңіз.',
      'scanServerError': 'Сервер сұрауды орындай алмады. Қайталап көріңіз.',
      'scanTimeout':
          'Күту уақыты аяқталды. Байланысты тексеріп, қайталап көріңіз.',
      'scanRequestFailed': 'Сұрауды орындау мүмкін болмады. Байланысты тексеріп, қайталап көріңіз.',
      'admitted': 'Кіру расталды',
      'alreadyAdmitted': 'Билет бұрын қолданылған',
      'wrongEvent': 'Билет басқа іс-шараға арналған',
      'notATicket': 'Бұл QR коды билет емес',
      'invalidTicket': 'Билет коды жарамсыз',
      'checkedInLabel': 'Кіргендер',
      'support': 'Қолдау',
      'newRequest': 'Жаңа өтініш',
      'noSupportRequests': 'Өтініштер жоқ',
      'refundRequest': 'Қайтару өтініші',
      'newSupportRequest': 'Қолдау қызметіне жаңа өтініш',
      'subject': 'Тақырып',
      'message': 'Хабарлама',
      'sending': 'Жіберілуде…',
      'sendRequest': 'Өтінішті жіберу',
      'supportConversation': 'Қолдау қызметімен хат алмасу',
      'reply': 'Жауап',
      'sendReply': 'Жауапты жіберу',
      'askRefund': 'Қайтару туралы сұрау',
      'supportOpen': 'Ашық',
      'supportInProgress': 'Қаралуда',
      'supportWaiting': 'Клиент жауабы күтілуде',
      'supportResolved': 'Шешілді',
      'appName': 'BiletFlow',
      'language': 'Тіл',
      'signOut': 'Шыгу',
      'welcome': 'Сәлем, {name}',
      'account': 'Аккаунт',
      'browseEvents': 'Іс-шаралар',
      'browseEventsSubtitle': 'Іздеу және іс-шара беті',
      'myTickets': 'Менің билеттерім',
      'myTicketsSubtitle': 'QR және басып шығаруға арналған PDF',
      'myEvents': 'Менің іс-шараларым',
      'allEventStatuses': 'Барлығы',
      'eventDraft': 'Нобай',
      'eventPublished': 'Жарияланған',
      'eventCancelled': 'Бас тартылған',
      'eventCompleted': 'Аяқталған',
      'eventDetails': 'Іс-шара туралы',
      'ticketTypes': 'Билет түрлері',
      'ticketInventory': 'Сатылды: {sold} · Қолжетімді: {available}',
      'scanTicket': 'Билетті сканерлеу',
      'email': 'Email',
      'password': 'Құпиясөз',
      'signIn': 'Кіру',
      'signingIn': 'Кіріп жатыр…',
      'emailRequired': 'Email енгізіңіз',
      'passwordRequired': 'Құпиясөз енгізіңіз',
      'searchEvents': 'Іс-шаралар, орындар…',
      'search': 'Іздеу',
      'city': 'Қала',
      'allCities': 'Барлық қалалар',
      'category': 'Санат',
      'visibility': 'Көрінуі',
      'preview': 'Алдын ала көру',
      'allCategories': 'Барлық санаттар',
      'price': 'Баға',
      'anyPrice': 'Кез келген баға',
      'free': 'Тегін',
      'under10k': '₸10 000-ға дейін',
      'over10k': '₸10 000+',
      'noEvents': 'Іс-шара табылмады',
      'soldOut': 'Сатылып кетті',
      'fromPrice': '₸{amount}-дан',
      'tickets': 'Билеттер',
      'noTicketTypes': 'Билет түрлері жоқ',
      'left': '{count} қалды',
      'organizer': 'Ұйымдастырушы: {name}',
      'continueWithTickets': '{count} билетпен жалғастыру',
      'selectTickets': 'Билет таңдаңыз',
      'checkout': 'Рәсімдеу',
      'fullName': 'Аты',
      'promoCode': 'Промокод',
      'apply': 'Қолдану',
      'promoApplied': 'Промокод қолданылды',
      'discount': 'Жеңілдік: −₸{amount}',
      'total': 'Жиыны: {amount}',
      'placeOrder': 'Тапсырыс беру',
      'working': 'Жіберілуде…',
      'order': 'Тапсырыс',
      'refresh': 'Жаңарту',
      'status': 'Күйі: {status}',
      'totalLabel': 'Жиыны: {amount}',
      'simulatedPayment': 'Сынақ төлемі. Нақты қаражат есептен шығарылмайды.',
      'approvePayment': 'Төлемді мақұлдау',
      'decline': 'Қабылдамау',
      'abandon': 'Бас тарту',
      'cancelReservation': 'Бронды болдырмау',
      'refundOrder': 'Тапсырысты қайтару',
      'refundConfirmation': 'Тапсырыстағы барлық билет жарамсыз болады. Қайтаруды жалғастырасыз ба?',
      'paymentSucceeded': 'Билеттеріңіз дайын.',
      'holdExpired': 'Брондау уақыты бітті. Билет берілген жоқ.',
      'orderClosed': 'Тапсырыс билетсіз жабылды.',
      'noTickets': 'Сізде әлі билет жоқ',
      'admissionQr': 'Кіру QR',
      'qrUnavailable': 'Бұл билет күйі үшін QR қолжетімсіз.',
      'ticketInvalid': 'Бұл билет кіруге жарамсыз.',
      'sharePdf': 'PDF бөлісу / сақтау',
      'preparingPdf': 'PDF дайындалуда…',
      'pdfFailed': 'PDF ашу мүмкін болмады',
      'qrNote': 'Кіреберісте осы QR-кодты көрсетіңіз.',
      'ticketStatusValid': 'Жарамды',
      'ticketStatusCheckedIn': 'Тексерілді',
      'ticketStatusCancelled': 'Тоқтатылды',
      'ticketStatusRefunded': 'Қайтарылды',
      'errorGeneric': 'Сұранысты орындау мүмкін болмады. Қайта көріңіз.',
      'errorValidation': 'Деректерді тексеріп, қайта көріңіз.',
      'errorConflict': 'Бұл билеттер енді қолжетімді емес.',
      'errorHoldExpired': 'Брондау уақыты бітті. Қайта бастаңыз.',
      'errorPromo': 'Бұл промокод тапсырысқа жарамайды.',
      'errorInvalid': 'Email немесе құпиясөз қате.',
      'errorForbidden': 'Бұл аккаунт бұғатталған.',
      'errorNotFound': 'Табылмады',
      'createAccount': 'Аккаунт ашу',
      'name': 'Аты',
      'nameRequired': 'Атыңызды енгізіңіз',
      'passwordHint': 'Кемінде 10 таңба',
      'registering': 'Аккаунт ашылуда…',
      'forgotPassword': 'Құпиясөзді ұмыттыңыз ба?',
      'forgotLead': 'Аккаунт болса, қалпына келтіру сілтемесін жібереміз.',
      'sendReset': 'Сілтеме жіберу',
      'sendingReset': 'Жіберілуде…',
      'resetSent':
          'Бұл email-ге аккаунт болса, қалпына келтіру сілтемесі жіберілді.',
      'resetPassword': 'Жаңа құпиясөз',
      'verifyEmail': 'Электрондық поштаны растау',
      'verificationLead': 'Хаттағы растау сілтемесін қойыңыз.',
      'resendVerification': 'Растау хатын қайта жіберу',
      'verificationSent': 'Растау хаты жіберілді.',
      'invalidEmailLink': 'Хаттағы жарамды сілтемені немесе токенді енгізіңіз.',
      'resetLead': 'Хаттағы сілтемені қойып, жаңа құпиясөз таңдаңыз.',
      'resetToken': 'Қалпына келтіру сілтемесі немесе токені',
      'newPassword': 'Жаңа құпиясөз',
      'savePassword': 'Құпиясөзді сақтау',
      'savingPassword': 'Сақталуда…',
      'backToSignIn': 'Кіруге оралу',
      'createEvent': 'Іс-шара құру',
      'editEvent': 'Іс-шараны өзгерту',
      'addTicketType': 'Билет түрін қосу',
      'editTicketType': 'Билет түрін өзгерту',
      'deleteTicketType': 'Билет түрін жою',
      'deleteTicketTypeTitle': 'Билет түрін жою керек пе?',
      'deleteTicketTypeBody':
          'Тек берілген билеті немесе броні жоқ түрді жоюға болады.',
      'back': 'Артқа',
      'delete': 'Жою',
      'hideTicketType':
          'Бұл түрде билет немесе брон бар. Оны сатудан жасырыңыз.',
      'cancelEvent': 'Іс-шараны болдырмау',
      'cancelReason': 'Болдырмау себебі',
      'publish': 'Жариялау',
      'unpublish': 'Жариялаудан алу',
      'duplicate': 'Көшіру',
      'attendanceAndCampaigns': 'Қатысу және кампаниялар',
      'eventTitle': 'Іс-шара атауы',
      'description': 'Сипаттама',
      'startsAt': 'Басталуы (ISO күні мен уақыты)',
      'endsAt': 'Аяқталуы (ISO күні мен уақыты)',
      'capacity': 'Сыйымдылық',
      'ticketName': 'Билет атауы',
      'priceKzt': 'Бағасы, теңге',
      'quantity': 'Саны',
      'maxPerOrder': 'Тапсырыстағы ең көбі',
      'requiredField': 'Міндетті өріс',
      'wholeNumber': 'Бүтін сан енгізіңіз',
      'isoDate': 'Күн мен уақытты ISO форматында енгізіңіз',
      'save': 'Сақтау',
      'saving': 'Сақталуда…',
      'eventReports': 'Іс-шара есептері',
      'attendance': 'Қатысу',
      'checkedInCount': 'Өтті: {checkedIn} / {registered}',
      'campaigns': 'Кампаниялар',
      'noCampaigns': 'Кампания жоқ',
      'campaignSubtitle': '{status} · өтеу: {count}',
      'redemptions': 'Өтеулер',
      'editCampaign': 'Кампанияны өзгерту',
      'campaignName': 'Кампания атауы',
      'campaignQr': 'Кампания QR',
      'paidOrders': 'Төленген тапсырыстар',
      'reportTickets': 'Билеттер',
      'grossSales': 'Жалпы сатылым',
      'discounts': 'Жеңілдіктер',
      'netSales': 'Таза сатылым',
      'active': 'Белсенді',
      'paidSalesReviews': 'Ақылы сатуды тексеру',
      'noPendingReviews': 'Тексеру өтініші жоқ',
      'approveReviewTitle': 'Ақылы сатуды мақұлдау керек пе?',
      'rejectReviewTitle': 'Ақылы сатуды қабылдамау керек пе?',
      'approveReviewBody':
          'Бұл ұйымдастырушының жеке басын тексеруді мақұлдайды.',
      'rejectReviewBody':
          'Бұл бас тартуды жазады және іс-шараның ақылы сатылымын өшіреді.',
      'approve': 'Мақұлдау',
      'reject': 'Қабылдамау',
      'feePaid': 'Алым төленді',
      'feePending': 'Алым төленбеді',
      'payoutConnected': 'Төлем шоты қосылған',
      'payoutPending': 'Төлем шоты қосылмаған',
      'retry': 'Қайталау',
      'decrease': 'Азайту',
      'increase': 'Көбейту',
      'promoOrCampaign': 'Промокод немесе кампания сілтемесі',
      'campaignApplied': 'Кампания қолданылды',
      'hidden': 'Жасырын',
      'errorAuth': 'Қайта кіріңіз',
      'discover': 'Іс-шаралар',
      'welcomeBack': 'Қош келдіңіз',
      'heroTitle': 'Келесі керемет іс-шараңыз',
      'heroAccent': 'осы жерден басталады',
      'upcoming': 'Алдағы іс-шаралар',
      'workspace': 'Басқару',
      'orderHistory': 'Тапсырыстар тарихы',
      'noOrders': 'Әзірге тапсырыс жоқ',
      'registrationUnavailable': 'Тіркелу жабық.',
      'paidSalesUnavailable': 'Бұл іс-шараға ақылы билеттер қазір сатылмайды.',
      'paid': 'Расталды',
      'awaiting': 'Төлем күтілуде',
      'expired': 'Мерзімі аяқталды',
      'failed': 'Төлем өтпеді',
      'unknown': 'Қолжетімсіз',
      'rate': 'Әрекет саны тым көп. Біраз күтіп, қайталап көріңіз.',
      'simRefund': 'Бұл — сынақ қайтарымы. Билеттеріңіз жарамсыз болады.',
      'testOrder': 'Сынақ операциясы',
      'verified': 'Электрондық пошта расталды',
    },
  };

  String _t(String key) {
    final lang = locale.languageCode;
    return _tables[lang]?[key] ?? _tables['en']![key] ?? key;
  }

  String _fmt(String key, Map<String, String> params) {
    var value = _t(key);
    params.forEach((k, v) => value = value.replaceAll('{$k}', v));
    return value;
  }

  String get appName => _t('appName');
  String get language => _t('language');
  String get signOut => _t('signOut');
  String welcome(String name) => _fmt('welcome', {'name': name});
  String get account => _t('account');
  String get browseEvents => _t('browseEvents');
  String get browseEventsSubtitle => _t('browseEventsSubtitle');
  String get myTickets => _t('myTickets');
  String get myTicketsSubtitle => _t('myTicketsSubtitle');
  String get myEvents => _t('myEvents');
  String get allEventStatuses => _t('allEventStatuses');
  String get eventDetails => _t('eventDetails');
  String get ticketTypes => _t('ticketTypes');
  String ticketInventory(int sold, int available) =>
      _fmt('ticketInventory', {'sold': '$sold', 'available': '$available'});

  String eventStatus(String value) => switch (value) {
    'DRAFT' => _t('eventDraft'),
    'PUBLISHED' => _t('eventPublished'),
    'CANCELLED' => _t('eventCancelled'),
    'COMPLETED' => _t('eventCompleted'),
    _ => value,
  };
  String get scanTicket => _t('scanTicket');
  String get scannerTitle => _t('scannerTitle');
  String get loadScanEvents => _t('loadScanEvents');
  String get noScanEvents => _t('noScanEvents');
  String get selectScanEvent => _t('selectScanEvent');
  String get stopCamera => _t('stopCamera');
  String get refreshAttendance => _t('refreshAttendance');
  String get attendeeSearch => _t('attendeeSearch');
  String get searchAttendees => _t('searchAttendees');
  String get noMatchingAttendees => _t('noMatchingAttendees');
  String get reverse => _t('reverse');
  String get reverseQuestion => _t('reverseQuestion');
  String get reverseCheckIn => _t('reverseCheckIn');
  String get reason => _t('reason');
  String get cancel => _t('cancel');
  String get threeCharacters => _t('threeCharacters');
  String get checkInReversed => _t('checkInReversed');
  String get cameraStopFailed => _t('cameraStopFailed');
  String get cameraOpenFailed => _t('cameraOpenFailed');
  String get cameraInUse => _t('cameraInUse');
  String get cameraDenied => _t('cameraDenied');
  String get scanAccessChanged => _t('scanAccessChanged');
  String get scanUnavailable => _t('scanUnavailable');
  String get scanChanged => _t('scanChanged');
  String get scanRateLimited => _t('scanRateLimited');
  String get scanServerError => _t('scanServerError');
  String get scanTimeout => _t('scanTimeout');
  String get scanRequestFailed => _t('scanRequestFailed');
  String get checkedInLabel => _t('checkedInLabel');
  String get support => _t('support');
  String get newRequest => _t('newRequest');
  String get noSupportRequests => _t('noSupportRequests');
  String get refundRequest => _t('refundRequest');
  String get newSupportRequest => _t('newSupportRequest');
  String get subject => _t('subject');
  String get message => _t('message');
  String get sending => _t('sending');
  String get sendRequest => _t('sendRequest');
  String get supportConversation => _t('supportConversation');
  String get reply => _t('reply');
  String get sendReply => _t('sendReply');
  String get askRefund => _t('askRefund');

  String scanResult(String code) => switch (code) {
    'VALID' => _t('admitted'),
    'ALREADY_CHECKED_IN' => _t('alreadyAdmitted'),
    'WRONG_EVENT' => _t('wrongEvent'),
    'NOT_A_TICKET' => _t('notATicket'),
    'INVALID' => _t('invalidTicket'),
    'CANCELLED' || 'REFUNDED' => ticketStatus(code),
    _ => scanRequestFailed,
  };

  String supportStatus(String code) => switch (code) {
    'OPEN' => _t('supportOpen'),
    'IN_PROGRESS' => _t('supportInProgress'),
    'WAITING_FOR_CUSTOMER' => _t('supportWaiting'),
    'RESOLVED' => _t('supportResolved'),
    _ => code,
  };

  String get email => _t('email');
  String get password => _t('password');
  String get signIn => _t('signIn');
  String get signingIn => _t('signingIn');
  String get emailRequired => _t('emailRequired');
  String get passwordRequired => _t('passwordRequired');
  String get searchEvents => _t('searchEvents');
  String get search => _t('search');
  String get city => _t('city');
  String get allCities => _t('allCities');
  String get category => _t('category');
  String get venueField => locale.languageCode == 'ru'
      ? 'Площадка'
      : locale.languageCode == 'kk'
          ? 'Өтетін орын'
          : 'Venue';

  String get eventCoverUrlField => locale.languageCode == 'ru'
      ? 'Ссылка на обложку мероприятия'
      : locale.languageCode == 'kk'
          ? 'Іс-шара мұқабасының сілтемесі'
          : 'Event cover URL';

  String get visibility => _t('visibility');
  String get preview => _t('preview');
  String get allCategories => _t('allCategories');
  String get price => _t('price');
  String get anyPrice => _t('anyPrice');
  String get free => _t('free');
  String get under10k => _t('under10k');
  String get over10k => _t('over10k');
  String get noEvents => _t('noEvents');
  String get soldOut => _t('soldOut');
  String fromPrice(int amount) => _fmt('fromPrice', {
    'amount': formatWholeNumber(amount, locale.languageCode),
  });
  String get tickets => _t('tickets');
  String get noTicketTypes => _t('noTicketTypes');
  String left(int count) => _fmt('left', {'count': '$count'});
  String organizer(String name) => _fmt('organizer', {'name': name});
  String continueWithTickets(int count) =>
      _fmt('continueWithTickets', {'count': '$count'});
  String get selectTickets => _t('selectTickets');
  String get checkout => _t('checkout');
  String get discover => _t('discover');
  String get welcomeBack => _t('welcomeBack');
  String get heroTitle => _t('heroTitle');
  String get heroAccent => _t('heroAccent');
  String get upcoming => _t('upcoming');
  String get workspace => _t('workspace');
  String get orderHistory => _t('orderHistory');
  String get noOrders => _t('noOrders');
  String get registrationUnavailable => _t('registrationUnavailable');
  String get paidSalesUnavailable => _t('paidSalesUnavailable');
  String get testRefund => _t('simRefund');
  String get testTransaction => _t('testOrder');
  String get emailVerified => _t('verified');
  String get fullName => _t('fullName');
  String get promoCode => _t('promoCode');
  String get apply => _t('apply');
  String get promoApplied => _t('promoApplied');
  String discount(int amount) => _fmt('discount', {
    'amount': formatWholeNumber(amount, locale.languageCode),
  });
  String total(String amount) => _fmt('total', {'amount': amount});
  String get placeOrder => _t('placeOrder');
  String get working => _t('working');
  String get order => _t('order');
  String get refundOrder => _t('refundOrder');
  String get refundConfirmation => _t('refundConfirmation');
  String get refresh => _t('refresh');
  String status(String value) => _fmt('status', {'status': value});
  String totalLabel(String amount) => _fmt('totalLabel', {'amount': amount});
  String get simulatedPayment => _t('simulatedPayment');
  String get approvePayment => _t('approvePayment');
  String get decline => _t('decline');
  String get abandon => _t('abandon');
  String get cancelReservation => _t('cancelReservation');
  String get paymentSucceeded => _t('paymentSucceeded');
  String get holdExpired => _t('holdExpired');
  String get orderClosed => _t('orderClosed');
  String get noTickets => _t('noTickets');
  String get admissionQr => _t('admissionQr');
  String get qrUnavailable => _t('qrUnavailable');
  String get ticketInvalid => _t('ticketInvalid');
  String get sharePdf => _t('sharePdf');
  String get preparingPdf => _t('preparingPdf');
  String get pdfFailed => _t('pdfFailed');
  String get qrNote => _t('qrNote');

  String ticketStatus(String code) {
    switch (code) {
      case 'VALID':
        return _t('ticketStatusValid');
      case 'CHECKED_IN':
        return _t('ticketStatusCheckedIn');
      case 'CANCELLED':
        return _t('ticketStatusCancelled');
      case 'REFUNDED':
        return _t('ticketStatusRefunded');
      default:
        return _t('unknown');
    }
  }

  String orderStatus(String code) => switch (code) {
    'PAID' => _t('paid'),
    'PENDING' || 'AWAITING_PAYMENT' => _t('awaiting'),
    'EXPIRED' => _t('expired'),
    'FAILED' => _t('failed'),
    _ => ticketStatus(code),
  };

  String apiError(String code) {
    final refundErrors = <String, List<String>>{
      'VENUE_REQUIRED': [
        'Select a venue and save before publishing.',
        'Выберите площадку и сохраните изменения перед публикацией.',
        'Жариялау алдында өтетін орынды таңдап, сақтаңыз.',
      ],
      'REFUND_WINDOW_24H': [
        'Refunds are not available less than 24 hours before the event.',
        'До начала мероприятия осталось менее 24 часов. Возврат недоступен.',
        'Іс-шараның басталуына 24 сағаттан аз уақыт қалды. Билетті қайтару мүмкін емес.',
      ],
      'REFUND_WINDOW_48H': [
        'Refunds are not available less than 48 hours before the event.',
        'До начала мероприятия осталось менее 48 часов. Возврат недоступен.',
        'Іс-шараның басталуына 48 сағаттан аз уақыт қалды. Билетті қайтару мүмкін емес.',
      ],
      'REFUND_NOT_ALLOWED': [
        'Tickets for this event are non-refundable.',
        'Билеты на это мероприятие не подлежат возврату.',
        'Бұл іс-шараның билеттері қайтарылмайды.',
      ],
      'REFUND_CHECKED_IN': [
        'Checked-in tickets cannot be refunded.',
        'Использованные билеты нельзя вернуть.',
        'Пайдаланылған билеттерді қайтару мүмкін емес.',
      ],
      'REFUND_UNPAID': [
        'Only paid orders can be refunded.',
        'Вернуть можно только оплаченный заказ.',
        'Тек төленген тапсырысты қайтаруға болады.',
      ],
      'REFUND_WINDOW_CLOSED': [
        'The refund period has ended.',
        'Срок возврата билетов истёк.',
        'Билеттерді қайтару мерзімі аяқталды.',
      ],
    };
    final refundMessage = refundErrors[code];
    if (refundMessage != null) {
      return refundMessage[switch (locale.languageCode) {
        'ru' => 1,
        'kk' => 2,
        _ => 0,
      }];
    }

    switch (code) {
      case 'VALIDATION_FAILED':
        return _t('errorValidation');
      case 'SOLD_OUT':
        return _t('errorConflict');
      case 'REGISTRATION_CLOSED':
      case 'TICKET_SALES_CLOSED':
        return registrationUnavailable;
      case 'PAID_SALES_INACTIVE':
        return paidSalesUnavailable;
      case 'HOLD_EXPIRED':
        return _t('errorHoldExpired');
      case 'PROMO_INVALID':
        return _t('errorPromo');
      case 'INVALID_CREDENTIALS':
      case 'UNAUTHORIZED':
        return _t('errorInvalid');
      case 'FORBIDDEN':
        return _t('errorForbidden');
      case 'NOT_FOUND':
        return _t('errorNotFound');
      case 'UNAUTHENTICATED':
        return _t('errorAuth');
      case 'RATE_LIMITED':
        return _t('rate');
      default:
        return _t('errorGeneric');
    }
  }

  String get createAccount => _t('createAccount');
  String get name => _t('name');
  String get nameRequired => _t('nameRequired');
  String get passwordHint => _t('passwordHint');
  String get registering => _t('registering');
  String get forgotPassword => _t('forgotPassword');
  String get forgotLead => _t('forgotLead');
  String get sendReset => _t('sendReset');
  String get sendingReset => _t('sendingReset');
  String get resetSent => _t('resetSent');
  String get resetPassword => _t('resetPassword');
  String get verifyEmail => _t('verifyEmail');
  String get verificationLead => _t('verificationLead');
  String get resendVerification => _t('resendVerification');
  String get verificationSent => _t('verificationSent');
  String get invalidEmailLink => _t('invalidEmailLink');
  String get resetLead => _t('resetLead');
  String get newPassword => _t('newPassword');
  String get savePassword => _t('savePassword');
  String get savingPassword => _t('savingPassword');
  String get resetToken => _t('resetToken');
  String get backToSignIn => _t('backToSignIn');
  String get createEvent => _t('createEvent');
  String get editEvent => _t('editEvent');
  String get addTicketType => _t('addTicketType');
  String get editTicketType => _t('editTicketType');
  String get deleteTicketType => _t('deleteTicketType');
  String get deleteTicketTypeTitle => _t('deleteTicketTypeTitle');
  String get deleteTicketTypeBody => _t('deleteTicketTypeBody');
  String get back => _t('back');
  String get delete => _t('delete');
  String get hideTicketType => _t('hideTicketType');
  String get cancelEvent => _t('cancelEvent');
  String get cancelReason => _t('cancelReason');
  String get publish => _t('publish');
  String get unpublish => _t('unpublish');
  String get duplicate => _t('duplicate');
  String get attendanceAndCampaigns => _t('attendanceAndCampaigns');
  String get eventTitle => _t('eventTitle');
  String get description => _t('description');
  String get startsAt => _t('startsAt');
  String get endsAt => _t('endsAt');
  String get capacity => _t('capacity');
  String get ticketName => _t('ticketName');
  String get priceKzt => _t('priceKzt');
  String get quantity => _t('quantity');
  String get maxPerOrder => _t('maxPerOrder');
  String get requiredField => _t('requiredField');
  String get wholeNumber => _t('wholeNumber');
  String get isoDate => _t('isoDate');
  String get save => _t('save');
  String get saving => _t('saving');
  String get eventReports => _t('eventReports');
  String get attendance => _t('attendance');
  String checkedInCount(Object checkedIn, Object registered) => _fmt(
    'checkedInCount',
    {'checkedIn': '$checkedIn', 'registered': '$registered'},
  );
  String get campaigns => _t('campaigns');
  String get noCampaigns => _t('noCampaigns');
  String campaignSubtitle(Object status, Object count) =>
      _fmt('campaignSubtitle', {'status': '$status', 'count': '$count'});
  String get redemptions => _t('redemptions');
  String get editCampaign => _t('editCampaign');
  String get campaignName => _t('campaignName');
  String get campaignQr => _t('campaignQr');
  String get paidOrders => _t('paidOrders');
  String get reportTickets => _t('reportTickets');
  String get grossSales => _t('grossSales');
  String get discounts => _t('discounts');
  String get netSales => _t('netSales');
  String get active => _t('active');
  String get paidSalesReviews => _t('paidSalesReviews');
  String get noPendingReviews => _t('noPendingReviews');
  String get approveReviewTitle => _t('approveReviewTitle');
  String get rejectReviewTitle => _t('rejectReviewTitle');
  String get approveReviewBody => _t('approveReviewBody');
  String get rejectReviewBody => _t('rejectReviewBody');
  String get approve => _t('approve');
  String get reject => _t('reject');
  String get feePaid => _t('feePaid');
  String get feePending => _t('feePending');
  String get payoutConnected => _t('payoutConnected');
  String get payoutPending => _t('payoutPending');
  String get retry => _t('retry');
  String get decrease => _t('decrease');
  String get increase => _t('increase');
  String get promoOrCampaign => _t('promoOrCampaign');
  String get campaignApplied => _t('campaignApplied');
  String get hidden => _t('hidden');

  String money(int amount) =>
      formatKzt(amount, freeLabel: free, languageCode: locale.languageCode);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) => AppLocalizations.supportedLocales.any(
    (item) => item.languageCode == locale.languageCode,
  );

  @override
  Future<AppLocalizations> load(Locale locale) =>
      SynchronousFuture(AppLocalizations(locale));

  @override
  bool shouldReload(covariant LocalizationsDelegate<AppLocalizations> old) =>
      false;
}
