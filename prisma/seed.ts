import { PrismaClient, Category } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Hoje.city with curadoria 29/03/2026...');

  // Clear existing events
  await prisma.event.deleteMany({});

  const events = [
    {
      title: 'Lady — Susana Vieira',
      description: 'Susana Vieira em um espetáculo intimista sobre poder, amor e liberdade feminina.',
      category: Category.MUSICA,
      startDate: new Date('2026-03-29T00:00:00.000Z'),
      time: '18h',
      venue: 'Sesc Palladium',
      address: 'Rua Rio de Janeiro, 1046',
      neighborhood: 'Centro',
      city: 'belo-horizonte',
      price: 'R$25–R$140',
      isFree: false,
      ticketUrl: 'https://www.sescmg.com.br',
      isVerified: true,
      isFeatured: true,
      isPublished: true,
    },
    {
      title: 'Delírio e Queda — Rita Clemente',
      description: 'Peça de teatro contemporâneo que explora os limites entre razão e loucura.',
      category: Category.TEATRO,
      startDate: new Date('2026-03-29T00:00:00.000Z'),
      time: '19h',
      venue: 'Sesc Palladium',
      address: 'Rua Rio de Janeiro, 1046',
      neighborhood: 'Centro',
      city: 'belo-horizonte',
      price: 'A partir de R$10',
      isFree: false,
      ticketUrl: 'https://www.sescmg.com.br',
      isVerified: true,
      isFeatured: false,
      isPublished: true,
    },
    {
      title: 'Circuito Cultural Barreiro — 14 Bis e outros',
      description: 'Festival de música ao ar livre no Barreiro com artistas locais e nacionais.',
      category: Category.RUA,
      startDate: new Date('2026-03-29T00:00:00.000Z'),
      time: '10h–21h',
      venue: 'Quinta Arte',
      address: 'Av. Afonso Vaz de Melo',
      neighborhood: 'Barreiro',
      city: 'belo-horizonte',
      price: 'Gratuito',
      isFree: true,
      isVerified: true,
      isFeatured: true,
      isPublished: true,
    },
    {
      title: 'A Mancha Invisível',
      description: 'Drama psicológico que investiga memória, culpa e redenção.',
      category: Category.TEATRO,
      startDate: new Date('2026-03-29T00:00:00.000Z'),
      time: '19h',
      venue: 'Galpão Cine Horto',
      address: 'Rua Gentios, 212',
      neighborhood: 'Horto',
      city: 'belo-horizonte',
      price: 'Gratuito',
      isFree: true,
      isVerified: true,
      isFeatured: false,
      isPublished: true,
    },
    {
      title: 'Afroapocalíptico — Grupo dos Dez',
      description: 'Espetáculo que revisita mitos africanos na perspectiva contemporânea brasileira.',
      category: Category.TEATRO,
      startDate: new Date('2026-03-29T00:00:00.000Z'),
      time: '19h',
      venue: 'Palácio das Artes',
      address: 'Av. Afonso Pena, 1537',
      neighborhood: 'Centro',
      city: 'belo-horizonte',
      price: 'Gratuito',
      isFree: true,
      isVerified: true,
      isFeatured: false,
      isPublished: true,
    },
    {
      title: 'MEME: no Br@sil da Memeficação',
      description: 'Exposição que analisa o fenômeno dos memes como linguagem cultural e política no Brasil.',
      category: Category.EXPO,
      startDate: new Date('2026-03-29T00:00:00.000Z'),
      endDate: new Date('2026-06-22T00:00:00.000Z'),
      time: '10h–22h',
      venue: 'CCBB BH',
      address: 'Praça da Liberdade, s/n',
      neighborhood: 'Funcionários',
      city: 'belo-horizonte',
      price: 'Gratuito',
      isFree: true,
      isVerified: true,
      isFeatured: true,
      isPublished: true,
    },
    {
      title: 'Encontro de Carrinhos de Rolimã',
      description: 'Tradição do bairro Califórnia reunindo crianças e adultos em corridas de carrinho.',
      category: Category.RUA,
      startDate: new Date('2026-03-29T00:00:00.000Z'),
      time: '9h–13h',
      venue: 'Bairro Califórnia',
      neighborhood: 'Califórnia',
      city: 'belo-horizonte',
      price: 'Gratuito',
      isFree: true,
      isVerified: true,
      isFeatured: false,
      isPublished: true,
    },
    {
      title: 'KLUB — Clube da Esquina por Telo Borges',
      description: 'Show em homenagem ao Clube da Esquina com arranjos inéditos de Telo Borges.',
      category: Category.MUSICA,
      startDate: new Date('2026-03-31T00:00:00.000Z'),
      time: '20h30',
      venue: 'Palácio das Artes',
      address: 'Av. Afonso Pena, 1537',
      neighborhood: 'Centro',
      city: 'belo-horizonte',
      price: 'A partir de R$80',
      isFree: false,
      ticketUrl: 'https://www.sympla.com.br',
      isVerified: true,
      isFeatured: true,
      isPublished: true,
    },
    {
      title: 'Raphael Ghanem — A Carne Só Cai no Prato do Vegano',
      description: 'Stand-up comedy sobre alimentação, ideologia e os paradoxos da vida moderna.',
      category: Category.STANDUP,
      startDate: new Date('2026-04-03T00:00:00.000Z'),
      time: '19h',
      venue: 'Cine Theatro Brasil',
      address: 'Av. Amazonas, 315',
      neighborhood: 'Centro',
      city: 'belo-horizonte',
      price: 'A confirmar',
      isFree: false,
      ticketUrl: 'https://www.sympla.com.br',
      isVerified: false,
      isFeatured: false,
      isPublished: true,
    },
  ];

  for (const event of events) {
    await prisma.event.create({ data: event });
  }

  console.log(`✅ Seeded ${events.length} events.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
