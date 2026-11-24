import 'package:flutter/foundation.dart';
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
      'checkoutNote': 'Server totals and inventory are authoritative. Paid orders use the authenticated simulated payment API.',
      'order': 'Order',
      'refresh': 'Refresh',
      'status': 'Status: {status}',
      'totalLabel': 'Total: {amount}',
      'simulatedPayment': 'Simulated payment — no real money moves.',
      'approvePayment': 'Approve payment',
      'decline': 'Decline',
      'abandon': 'Abandon',
      'cancelReservation': 'Cancel reservation',
      'refundOrder': 'Refund order',
      'refundConfirmation': 'All tickets in this order will be invalidated. Continue with the refund?',
      'paymentSucceeded': 'Payment succeeded. Tickets are ready.',
      'holdExpired': 'Checkout hold expired. No ticket was issued.',
      'orderClosed': 'Order closed without tickets.',
      'noTickets': 'No tickets yet',
      'admissionQr': 'Admission QR',
      'qrUnavailable': 'QR is unavailable for this ticket status.',
      'ticketInvalid': 'This ticket is not valid for entry.',
      'sharePdf': 'Share / save PDF',
      'preparingPdf': 'Preparing PDF…',
      'pdfFailed': 'Unable to open PDF',
      'qrNote': 'QR and PDF come from the server with your bearer token. The token is never put in the image URL.',
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
      'errorAuth': 'Sign in again',
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
      'checkoutNote': 'Итоги и наличие считает сервер. Оплата идёт через авторизованный симулятор без WebView.',
      'order': 'Заказ',
      'refresh': 'Обновить',
      'status': 'Статус: {status}',
      'totalLabel': 'Итого: {amount}',
      'simulatedPayment': 'Симуляция оплаты — реальные деньги не списываются.',
      'approvePayment': 'Одобрить оплату',
      'decline': 'Отклонить',
      'abandon': 'Отменить',
      'cancelReservation': 'Отменить бронь',
      'refundOrder': 'Вернуть заказ',
      'refundConfirmation': 'Все билеты в заказе станут недействительными. Продолжить возврат?',
      'paymentSucceeded': 'Оплата прошла. Билеты готовы.',
      'holdExpired': 'Время брони истекло. Билет не выдан.',
      'orderClosed': 'Заказ закрыт без билетов.',
      'noTickets': 'У вас пока нет билетов',
      'admissionQr': 'Входной QR',
      'qrUnavailable': 'QR недоступен для этого статуса билета.',
      'ticketInvalid': 'Этот билет не действует для входа.',
      'sharePdf': 'Поделиться / сохранить PDF',
      'preparingPdf': 'Готовим PDF…',
      'pdfFailed': 'Не удалось открыть PDF',
      'qrNote': 'QR и PDF загружаются с сервера с bearer-токеном. Токен не попадает в URL изображения.',
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
      'errorAuth': 'Войдите снова',
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
      'checkoutNote': 'Жиынтық пен қорды сервер есептейді. Төлем авторизацияланған симулятор арқылы өтеді.',
      'order': 'Тапсырыс',
      'refresh': 'Жаңарту',
      'status': 'Күйі: {status}',
      'totalLabel': 'Жиыны: {amount}',
      'simulatedPayment': 'Сынақ төлемі — нақты ақша қозғалмайды.',
      'approvePayment': 'Төлемді мақұлдау',
      'decline': 'Қабылдамау',
      'abandon': 'Бас тарту',
      'cancelReservation': 'Бронды болдырмау',
      'refundOrder': 'Тапсырысты қайтару',
      'refundConfirmation': 'Тапсырыстағы барлық билет жарамсыз болады. Қайтаруды жалғастырасыз ба?',
      'paymentSucceeded': 'Төлем өтті. Билеттер дайын.',
      'holdExpired': 'Брондау уақыты бітті. Билет берілген жоқ.',
      'orderClosed': 'Тапсырыс билетсіз жабылды.',
      'noTickets': 'Сізде әлі билет жоқ',
      'admissionQr': 'Кіру QR',
      'qrUnavailable': 'Бұл билет күйі үшін QR қолжетімсіз.',
      'ticketInvalid': 'Бұл билет кіруге жарамсыз.',
      'sharePdf': 'PDF бөлісу / сақтау',
      'preparingPdf': 'PDF дайындалуда…',
      'pdfFailed': 'PDF ашу мүмкін болмады',
      'qrNote': 'QR мен PDF серверден bearer токенмен жүктеледі. Токен сурет URL-іне енбейді.',
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
      'errorAuth': 'Қайта кіріңіз',
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
  String get allCategories => _t('allCategories');
  String get price => _t('price');
  String get anyPrice => _t('anyPrice');
  String get free => _t('free');
  String get under10k => _t('under10k');
  String get over10k => _t('over10k');
  String get noEvents => _t('noEvents');
  String get soldOut => _t('soldOut');
  String fromPrice(int amount) => _fmt('fromPrice', {'amount': '$amount'});
  String get tickets => _t('tickets');
  String get noTicketTypes => _t('noTicketTypes');
  String left(int count) => _fmt('left', {'count': '$count'});
  String organizer(String name) => _fmt('organizer', {'name': name});
  String continueWithTickets(int count) =>
      _fmt('continueWithTickets', {'count': '$count'});
  String get selectTickets => _t('selectTickets');
  String get checkout => _t('checkout');
  String get fullName => _t('fullName');
  String get promoCode => _t('promoCode');
  String get apply => _t('apply');
  String get promoApplied => _t('promoApplied');
  String discount(int amount) => _fmt('discount', {'amount': '$amount'});
  String total(String amount) => _fmt('total', {'amount': amount});
  String get placeOrder => _t('placeOrder');
  String get working => _t('working');
  String get checkoutNote => _t('checkoutNote');
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
        return code;
    }
  }

  String apiError(String code) {
    switch (code) {
      case 'VALIDATION_FAILED':
        return _t('errorValidation');
      case 'CONFLICT':
      case 'SOLD_OUT':
        return _t('errorConflict');
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
      default:
        return code.isEmpty ? _t('errorGeneric') : code;
    }
  }

  String money(int amount) => amount == 0 ? free : '₸$amount';
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
