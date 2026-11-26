import { formatKzt } from "./format";

export function notificationLocale(locale: string | null | undefined) {
  return locale === "en" || locale === "kk" ? locale : "ru";
}

export const notificationCopy = {
  en: {
    order: (ref: string) => `BiletFlow order ${ref} confirmed`,
    confirmation: (ref: string, title: string) =>
      `Your order ${ref} for “${title}” is confirmed.`,
    quantity: (count: number) => `Tickets issued: ${count}`,
    total: (amount: number) => `Total: ${formatKzt(amount, "en")}`,
    tickets: (ref: string) => `BiletFlow tickets for ${ref}`,
    ready: (title: string) => `Your tickets for “${title}” are ready.`,
    view: (url: string) => `View or download your tickets: ${url}`,
    testPayment: "Test payment. No real funds were charged.",
    failed: (ref: string) => `Payment not completed for order ${ref}`,
    tryAgain: (title: string) =>
      `No tickets were issued for “${title}”. You can start checkout again from the event page.`,
    reservation: (ref: string) => `Reservation ${ref} cancelled`,
    released: (title: string) =>
      `Your reservation for “${title}” was cancelled. No payment was taken.`,
    refund: (ref: string) => `Test refund for order ${ref}`,
    refundAmount: (title: string, amount: number) =>
      `A test refund of ${formatKzt(amount, "en")} was recorded for “${title}”.`,
    invalid: "The tickets can no longer be used for admission.",
    cancelled: (title: string) => `Event cancelled: ${title}`,
    reason: (ref: string, reason: string) => `Order ${ref}. Reason: ${reason}`,
    cancelledRefund:
      "A test refund was recorded and the tickets are no longer valid.",
    support: (ref: string) => `New reply on support case ${ref}`,
    supportReply: (subject: string) =>
      `There is a new reply to “${subject}”. Open the case in BiletFlow to reply.`,
  },
  ru: {
    order: (ref: string) => `Заказ BiletFlow ${ref} подтверждён`,
    confirmation: (ref: string, title: string) =>
      `Ваш заказ ${ref} на «${title}» подтверждён.`,
    quantity: (count: number) => `Выдано билетов: ${count}`,
    total: (amount: number) => `Итого: ${formatKzt(amount, "ru")}`,
    tickets: (ref: string) => `Билеты BiletFlow по заказу ${ref}`,
    ready: (title: string) => `Ваши билеты на «${title}» готовы.`,
    view: (url: string) => `Открыть или скачать билеты: ${url}`,
    testPayment: "Тестовая оплата. Реальные средства не были списаны.",
    failed: (ref: string) => `Оплата заказа ${ref} не завершена`,
    tryAgain: (title: string) =>
      `Билеты на «${title}» не выданы. Начните оформление заново со страницы мероприятия.`,
    reservation: (ref: string) => `Бронь ${ref} отменена`,
    released: (title: string) =>
      `Ваша бронь на «${title}» отменена. Средства не списаны.`,
    refund: (ref: string) => `Тестовый возврат по заказу ${ref}`,
    refundAmount: (title: string, amount: number) =>
      `По мероприятию «${title}» оформлен тестовый возврат на ${formatKzt(amount, "ru")}.`,
    invalid: "Билеты больше не действуют для входа.",
    cancelled: (title: string) => `Мероприятие отменено: ${title}`,
    reason: (ref: string, reason: string) => `Заказ ${ref}. Причина: ${reason}`,
    cancelledRefund: "Оформлен тестовый возврат. Билеты больше не действуют.",
    support: (ref: string) => `Новый ответ на обращение ${ref}`,
    supportReply: (subject: string) =>
      `На обращение «${subject}» поступил ответ. Откройте переписку в BiletFlow, чтобы ответить.`,
  },
  kk: {
    order: (ref: string) => `BiletFlow тапсырысы ${ref} расталды`,
    confirmation: (ref: string, title: string) =>
      `«${title}» іс-шарасына ${ref} тапсырысыңыз расталды.`,
    quantity: (count: number) => `Берілген билет саны: ${count}`,
    total: (amount: number) => `Жалпы сома: ${formatKzt(amount, "kk")}`,
    tickets: (ref: string) => `BiletFlow билеттері, тапсырыс ${ref}`,
    ready: (title: string) => `«${title}» іс-шарасына билеттеріңіз дайын.`,
    view: (url: string) => `Билеттерді ашу немесе жүктеп алу: ${url}`,
    testPayment: "Сынақ төлемі. Нақты қаражат есептен шығарылған жоқ.",
    failed: (ref: string) => `${ref} тапсырысының төлемі аяқталмады`,
    tryAgain: (title: string) =>
      `«${title}» іс-шарасына билеттер берілген жоқ. Іс-шара бетінен қайта тапсырыс бере аласыз.`,
    reservation: (ref: string) => `${ref} броні жойылды`,
    released: (title: string) =>
      `«${title}» іс-шарасына броніңіз жойылды. Қаражат есептен шығарылған жоқ.`,
    refund: (ref: string) => `${ref} тапсырысы бойынша сынақ қайтарымы`,
    refundAmount: (title: string, amount: number) =>
      `«${title}» іс-шарасы бойынша ${formatKzt(amount, "kk")} сомасына сынақ қайтарымы тіркелді.`,
    invalid: "Бұл билеттер енді кіруге жарамсыз.",
    cancelled: (title: string) => `Іс-шара тоқтатылды: ${title}`,
    reason: (ref: string, reason: string) =>
      `Тапсырыс: ${ref}. Себебі: ${reason}`,
    cancelledRefund: "Сынақ қайтарымы тіркелді. Билеттер енді жарамсыз.",
    support: (ref: string) => `${ref} өтінішіне жаңа жауап келді`,
    supportReply: (subject: string) =>
      `«${subject}» өтінішіне жауап келді. Жауап беру үшін BiletFlow жүйесінде өтінішті ашыңыз.`,
  },
};
